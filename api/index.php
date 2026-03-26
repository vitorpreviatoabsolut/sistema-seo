<?php
require_once '../db.php';

ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    throw new ErrorException($message, 0, $severity, $file, $line);
});

function getRequestData() {
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode($rawInput, true);

    if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
        return $jsonData;
    }

    if (!empty($_POST)) {
        return $_POST;
    }

    return array();
}

function respondJson($data, $statusCode) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

function ensureGenerationTables(PDO $pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS generation_jobs (
            id VARCHAR(64) PRIMARY KEY,
            client_id INT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'paused',
            total INT NOT NULL DEFAULT 0,
            generated_count INT NOT NULL DEFAULT 0,
            current_index INT NOT NULL DEFAULT 0,
            message TEXT NULL,
            zip_filename VARCHAR(255) NOT NULL,
            config_json LONGTEXT NULL,
            items_json LONGTEXT NULL,
            completed_json LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_generation_jobs_client
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
}

function ensureClientColumns(PDO $pdo) {
    $requiredColumns = array(
        'template_content' => 'ALTER TABLE clients ADD COLUMN template_content LONGTEXT NULL',
        'whatsapp_number' => 'ALTER TABLE clients ADD COLUMN whatsapp_number VARCHAR(50) NULL',
        'whatsapp_message' => 'ALTER TABLE clients ADD COLUMN whatsapp_message TEXT NULL'
    );

    foreach ($requiredColumns as $columnName => $sql) {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM clients LIKE ?");
        $stmt->execute(array($columnName));
        $column = $stmt->fetch();

        if (!$column) {
            $pdo->exec($sql);
        }
    }
}

function ensureTemplatesTable(PDO $pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id INT NOT NULL UNIQUE,
            content LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_templates_client
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
}

function getJobsBaseDir() {
    $dir = realpath(__DIR__ . '/../jobs');

    if ($dir === false) {
        $dir = __DIR__ . '/../jobs';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }

    return $dir;
}

function getJobDir($jobId) {
    return getJobsBaseDir() . DIRECTORY_SEPARATOR . $jobId;
}

function getJobZipPath($job) {
    return getJobsBaseDir() . DIRECTORY_SEPARATOR . $job['zip_filename'];
}

function decodeJsonArray($value) {
    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : array();
}

function normalizeCompletedIndexes($value) {
    $decoded = decodeJsonArray($value);
    $indexes = array();

    foreach ($decoded as $index) {
        $indexes[] = (int) $index;
    }

    $indexes = array_values(array_unique($indexes));
    sort($indexes);
    return $indexes;
}

function buildDownloadUrl($jobId) {
    return '/api/jobs/' . rawurlencode($jobId) . '/download';
}

function generateJobId() {
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(16));
    }

    if (function_exists('openssl_random_pseudo_bytes')) {
        $bytes = openssl_random_pseudo_bytes(16);
        if ($bytes !== false) {
            return bin2hex($bytes);
        }
    }

    return md5(uniqid(mt_rand(), true)) . substr(md5(microtime(true)), 0, 16);
}

function formatJob($job) {
    $completed = normalizeCompletedIndexes(isset($job['completed_json']) ? $job['completed_json'] : '[]');
    $config = decodeJsonArray(isset($job['config_json']) ? $job['config_json'] : '{}');
    $items = decodeJsonArray(isset($job['items_json']) ? $job['items_json'] : '[]');

    return array(
        'id' => $job['id'],
        'client_id' => (int) $job['client_id'],
        'status' => $job['status'],
        'total' => (int) $job['total'],
        'progress' => (int) $job['generated_count'],
        'generated_count' => (int) $job['generated_count'],
        'current_index' => (int) $job['current_index'],
        'message' => !empty($job['message']) ? $job['message'] : '',
        'zip_filename' => $job['zip_filename'],
        'download_url' => buildDownloadUrl($job['id']),
        'config' => $config,
        'items' => $items,
        'completed_indexes' => $completed,
    );
}

function getLatestJobForClient(PDO $pdo, $clientId) {
    $stmt = $pdo->prepare('SELECT * FROM generation_jobs WHERE client_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1');
    $stmt->execute(array($clientId));
    $job = $stmt->fetch();
    return $job ? $job : null;
}

function getJobById(PDO $pdo, $jobId) {
    $stmt = $pdo->prepare('SELECT * FROM generation_jobs WHERE id = ?');
    $stmt->execute(array($jobId));
    $job = $stmt->fetch();
    return $job ? $job : null;
}

function requireJob(PDO $pdo, $jobId) {
    $job = getJobById($pdo, $jobId);

    if (!$job) {
        respondJson(array('error' => 'Job nao encontrado.'), 404);
    }

    return $job;
}

function buildZipFromDirectory($job, $destinationPath) {
    $jobDir = getJobDir($job['id']);
    $zipDir = dirname($destinationPath);

    if (!is_dir($zipDir)) {
        mkdir($zipDir, 0755, true);
    }

    if (file_exists($destinationPath)) {
        @unlink($destinationPath);
    }

    $zip = new ZipArchive();
    $result = $zip->open($destinationPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

    if ($result !== true) {
        throw new Exception('Nao foi possivel criar o arquivo ZIP.');
    }

    if (is_dir($jobDir)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($jobDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }

            $filePath = $fileInfo->getRealPath();
            $localName = substr($filePath, strlen($jobDir) + 1);
            $localName = str_replace('\\', '/', $localName);
            $zip->addFile($filePath, $localName);
        }
    }

    if (!$zip->close()) {
        throw new Exception('Nao foi possivel finalizar o arquivo ZIP.');
    }
}

function saveGeneratedFile(PDO $pdo, $job, $index, $filename, $content) {
    $items = decodeJsonArray(isset($job['items_json']) ? $job['items_json'] : '[]');

    if (!isset($items[$index])) {
        throw new Exception('Indice de arquivo invalido para este job.');
    }

    $jobDir = getJobDir($job['id']);
    if (!is_dir($jobDir) && !mkdir($jobDir, 0755, true) && !is_dir($jobDir)) {
        throw new Exception('Nao foi possivel criar o diretorio do job.');
    }

    $safeFilename = trim(str_replace(array('..\\', '../'), '', (string) $filename));
    if ($safeFilename === '') {
        throw new Exception('Nome de arquivo invalido.');
    }

    $targetPath = $jobDir . DIRECTORY_SEPARATOR . $safeFilename;
    if (file_put_contents($targetPath, $content) === false) {
        throw new Exception('Nao foi possivel salvar o arquivo gerado.');
    }

    $completedIndexes = normalizeCompletedIndexes(isset($job['completed_json']) ? $job['completed_json'] : '[]');
    if (!in_array((int) $index, $completedIndexes, true)) {
        $completedIndexes[] = (int) $index;
    }

    sort($completedIndexes);

    $generatedCount = count($completedIndexes);
    $currentIndex = $generatedCount;
    $status = $generatedCount >= (int) $job['total'] ? 'completed' : 'running';
    $message = $status === 'completed' ? 'Geracao concluida.' : 'Arquivo salvo: ' . $safeFilename;

    $stmt = $pdo->prepare('
        UPDATE generation_jobs
        SET generated_count = ?, current_index = ?, completed_json = ?, status = ?, message = ?
        WHERE id = ?
    ');
    $stmt->execute(array(
        $generatedCount,
        $currentIndex,
        json_encode($completedIndexes),
        $status,
        $message,
        $job['id'],
    ));
}

ensureGenerationTables($pdo);
ensureClientColumns($pdo);
ensureTemplatesTable($pdo);

$scriptName = $_SERVER['SCRIPT_NAME'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptDir = dirname($scriptName);
$path = str_replace(str_replace('\\', '/', $scriptDir), '', $requestUri);
$path = preg_replace('/^[\/]?index\.php\//', '', $path);
$path = trim($path, '/');
$parts = explode('/', $path);

$resource = isset($parts[0]) ? $parts[0] : '';
$id = isset($parts[1]) ? $parts[1] : null;
$subResource = isset($parts[2]) ? $parts[2] : null;
$action = isset($parts[3]) ? $parts[3] : null;
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($resource === 'clients') {
        if ($method === 'GET' && !$id) {
            $stmt = $pdo->query('SELECT * FROM clients ORDER BY id DESC');
            respondJson($stmt->fetchAll(), 200);
        }

        if ($method === 'POST' && !$id) {
            $data = getRequestData();
            $stmt = $pdo->prepare('INSERT INTO clients (name, context) VALUES (?, ?)');
            $stmt->execute(array(isset($data['name']) ? $data['name'] : '', isset($data['context']) ? $data['context'] : ''));
            respondJson(array('id' => $pdo->lastInsertId()), 200);
        }

        if ($method === 'DELETE' && $id && !$subResource) {
            $stmt = $pdo->prepare('DELETE FROM clients WHERE id = ?');
            $stmt->execute(array($id));
            respondJson(array('success' => true), 200);
        }

        if ($method === 'GET' && $id && $subResource === 'keywords') {
            $stmt = $pdo->prepare('SELECT * FROM keywords WHERE client_id = ? ORDER BY id DESC');
            $stmt->execute(array($id));
            respondJson($stmt->fetchAll(), 200);
        }

        if ($method === 'POST' && $id && $subResource === 'keywords' && $action === 'bulk') {
            $data = getRequestData();
            $keywords = isset($data['keywords']) ? $data['keywords'] : array();

            if (!is_array($keywords) || empty($keywords)) {
                respondJson(array('error' => 'Nenhuma palavra-chave recebida para salvar.'), 400);
            }

            $stmt = $pdo->prepare('INSERT INTO keywords (client_id, keyword) VALUES (?, ?)');
            $savedCount = 0;
            foreach ($keywords as $kw) {
                $kw = trim((string) $kw);
                if ($kw === '') {
                    continue;
                }
                $stmt->execute(array($id, $kw));
                $savedCount++;
            }

            respondJson(array('success' => true, 'saved_count' => $savedCount), 200);
        }

        if ($method === 'DELETE' && $id && $subResource === 'keywords') {
            $stmt = $pdo->prepare('DELETE FROM keywords WHERE client_id = ?');
            $stmt->execute(array($id));
            respondJson(array('success' => true), 200);
        }

        if ($method === 'GET' && $id && $subResource === 'regions') {
            $stmt = $pdo->prepare('SELECT * FROM regions WHERE client_id = ? ORDER BY id DESC');
            $stmt->execute(array($id));
            respondJson($stmt->fetchAll(), 200);
        }

        if ($method === 'POST' && $id && $subResource === 'regions' && $action === 'bulk') {
            $data = getRequestData();
            $regions = isset($data['regions']) ? $data['regions'] : array();

            if (!is_array($regions) || empty($regions)) {
                respondJson(array('error' => 'Nenhuma regiao recebida para salvar.'), 400);
            }

            $stmt = $pdo->prepare('INSERT INTO regions (client_id, region) VALUES (?, ?)');
            $savedCount = 0;
            foreach ($regions as $reg) {
                $reg = trim((string) $reg);
                if ($reg === '') {
                    continue;
                }
                $stmt->execute(array($id, $reg));
                $savedCount++;
            }

            respondJson(array('success' => true, 'saved_count' => $savedCount), 200);
        }

        if ($method === 'DELETE' && $id && $subResource === 'regions') {
            $stmt = $pdo->prepare('DELETE FROM regions WHERE client_id = ?');
            $stmt->execute(array($id));
            respondJson(array('success' => true), 200);
        }

        if ($method === 'GET' && $id && $subResource === 'template') {
            $stmt = $pdo->prepare('SELECT content FROM templates WHERE client_id = ? LIMIT 1');
            $stmt->execute(array($id));
            $result = $stmt->fetch();

            if ($result && isset($result['content'])) {
                respondJson(array('content' => $result['content']), 200);
            }

            $stmt = $pdo->prepare('SELECT template_content as content FROM clients WHERE id = ?');
            $stmt->execute(array($id));
            $result = $stmt->fetch();
            respondJson($result ? $result : array('content' => ''), 200);
        }

        if ($method === 'POST' && $id && $subResource === 'template') {
            $data = getRequestData();
            $content = isset($data['content']) ? $data['content'] : '';

            $stmt = $pdo->prepare('SELECT id FROM templates WHERE client_id = ? LIMIT 1');
            $stmt->execute(array($id));
            $existingTemplate = $stmt->fetch();

            if ($existingTemplate) {
                $stmt = $pdo->prepare('UPDATE templates SET content = ? WHERE client_id = ?');
                $stmt->execute(array($content, $id));
            } else {
                $stmt = $pdo->prepare('INSERT INTO templates (client_id, content) VALUES (?, ?)');
                $stmt->execute(array($id, $content));
            }

            $stmt = $pdo->prepare('UPDATE clients SET template_content = ? WHERE id = ?');
            $stmt->execute(array($content, $id));
            respondJson(array('success' => true), 200);
        }

        if ($method === 'PUT' && $id && $subResource === 'whatsapp') {
            $data = getRequestData();
            $stmt = $pdo->prepare('UPDATE clients SET whatsapp_number = ?, whatsapp_message = ? WHERE id = ?');
            $stmt->execute(array(
                isset($data['whatsapp_number']) ? $data['whatsapp_number'] : null,
                isset($data['whatsapp_message']) ? $data['whatsapp_message'] : null,
                $id,
            ));
            respondJson(array('success' => true), 200);
        }

        if ($id && $subResource === 'generation-job') {
            if ($method === 'GET') {
                $job = getLatestJobForClient($pdo, $id);
                respondJson($job ? formatJob($job) : array('job' => null), 200);
            }

            if ($method === 'POST') {
                $data = getRequestData();
                $existingJob = getLatestJobForClient($pdo, $id);

                if ($existingJob && $existingJob['status'] !== 'completed') {
                    if ($existingJob['status'] !== 'running') {
                        $stmt = $pdo->prepare("UPDATE generation_jobs SET status = 'running', message = ? WHERE id = ?");
                        $stmt->execute(array('Retomando geracao...', $existingJob['id']));
                        $existingJob = getJobById($pdo, $existingJob['id']);
                    }

                    respondJson(formatJob($existingJob), 200);
                }

                $items = isset($data['items']) && is_array($data['items']) ? array_values($data['items']) : array();
                if (empty($items)) {
                    respondJson(array('error' => 'Nenhum item foi enviado para a geracao.'), 400);
                }

                $jobId = generateJobId();
                $jobDir = getJobDir($jobId);
                if (!is_dir($jobDir)) {
                    mkdir($jobDir, 0755, true);
                }

                $config = array(
                    'template' => isset($data['template']) ? (string) $data['template'] : '',
                    'client_name' => isset($data['client_name']) ? (string) $data['client_name'] : '',
                    'client_context' => isset($data['client_context']) ? (string) $data['client_context'] : '',
                    'whatsapp_number' => isset($data['whatsapp_number']) ? (string) $data['whatsapp_number'] : '',
                    'whatsapp_message' => isset($data['whatsapp_message']) ? (string) $data['whatsapp_message'] : '',
                );

                $stmt = $pdo->prepare('
                    INSERT INTO generation_jobs (
                        id, client_id, status, total, generated_count, current_index,
                        message, zip_filename, config_json, items_json, completed_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ');
                $stmt->execute(array(
                    $jobId,
                    $id,
                    'running',
                    count($items),
                    0,
                    0,
                    'Iniciando geracao...',
                    'seo-job-' . $jobId . '.zip',
                    json_encode($config),
                    json_encode($items),
                    json_encode(array()),
                ));

                respondJson(formatJob(requireJob($pdo, $jobId)), 201);
            }
        }
    }

    if ($resource === 'keywords' && $method === 'DELETE' && $id) {
        $stmt = $pdo->prepare('DELETE FROM keywords WHERE id = ?');
        $stmt->execute(array($id));
        respondJson(array('success' => true), 200);
    }

    if ($resource === 'regions' && $method === 'DELETE' && $id) {
        $stmt = $pdo->prepare('DELETE FROM regions WHERE id = ?');
        $stmt->execute(array($id));
        respondJson(array('success' => true), 200);
    }

    if ($resource === 'global-templates') {
        if ($method === 'GET') {
            $stmt = $pdo->query('SELECT * FROM global_templates ORDER BY id DESC');
            respondJson($stmt->fetchAll(), 200);
        }

        if ($method === 'POST') {
            $data = getRequestData();
            $stmt = $pdo->prepare('INSERT INTO global_templates (name, content) VALUES (?, ?)');
            $stmt->execute(array(isset($data['name']) ? $data['name'] : '', isset($data['content']) ? $data['content'] : ''));
            respondJson(array('id' => $pdo->lastInsertId()), 200);
        }

        if ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare('DELETE FROM global_templates WHERE id = ?');
            $stmt->execute(array($id));
            respondJson(array('success' => true), 200);
        }
    }

    if ($resource === 'jobs' && $id) {
        $job = requireJob($pdo, $id);

        if ($method === 'GET' && !$subResource) {
            respondJson(formatJob($job), 200);
        }

        if ($method === 'GET' && $subResource === 'download') {
            $zipPath = getJobZipPath($job);
            buildZipFromDirectory($job, $zipPath);

            if (!file_exists($zipPath)) {
                respondJson(array('error' => 'Arquivo ZIP nao encontrado.'), 404);
            }

            header('Content-Type: application/zip');
            header('Content-Length: ' . filesize($zipPath));
            header('Content-Disposition: attachment; filename="' . basename($job['zip_filename']) . '"');
            readfile($zipPath);
            exit;
        }

        if ($method === 'POST' && $subResource === 'files') {
            $data = getRequestData();
            $index = isset($data['index']) ? (int) $data['index'] : -1;
            $filename = isset($data['filename']) ? (string) $data['filename'] : '';
            $content = isset($data['content']) ? (string) $data['content'] : '';

            saveGeneratedFile($pdo, $job, $index, $filename, $content);
            respondJson(formatJob(requireJob($pdo, $id)), 200);
        }

        if ($method === 'POST' && $subResource === 'pause') {
            $stmt = $pdo->prepare("UPDATE generation_jobs SET status = 'paused', message = ? WHERE id = ?");
            $stmt->execute(array('Geracao pausada.', $id));
            respondJson(formatJob(requireJob($pdo, $id)), 200);
        }

        if ($method === 'POST' && $subResource === 'resume') {
            $stmt = $pdo->prepare("UPDATE generation_jobs SET status = 'running', message = ? WHERE id = ?");
            $stmt->execute(array('Retomando geracao...', $id));
            respondJson(formatJob(requireJob($pdo, $id)), 200);
        }

        if ($method === 'POST' && $subResource === 'complete') {
            $stmt = $pdo->prepare("UPDATE generation_jobs SET status = 'completed', message = ? WHERE id = ?");
            $stmt->execute(array('Geracao concluida.', $id));
            respondJson(formatJob(requireJob($pdo, $id)), 200);
        }

        if ($method === 'POST' && $subResource === 'error') {
            $data = getRequestData();
            $message = isset($data['message']) ? (string) $data['message'] : 'Erro na geracao.';
            $stmt = $pdo->prepare("UPDATE generation_jobs SET status = 'error', message = ? WHERE id = ?");
            $stmt->execute(array($message, $id));
            respondJson(formatJob(requireJob($pdo, $id)), 200);
        }
    }

    respondJson(array('error' => 'Endpoint not found', 'path' => $path), 404);
} catch (PDOException $e) {
    respondJson(array('error' => 'Database error: ' . $e->getMessage()), 500);
} catch (Exception $e) {
    respondJson(array('error' => 'Application error: ' . $e->getMessage()), 500);
}
?>
