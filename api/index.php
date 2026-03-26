<?php
require_once '../db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function getRequestData() {
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode($rawInput, true);

    if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
        return $jsonData;
    }

    if (!empty($_POST)) {
        return $_POST;
    }

    return [];
}

function respondJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

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
            respondJson($stmt->fetchAll());
        }

        if ($method === 'POST' && !$id) {
            $data = getRequestData();
            $stmt = $pdo->prepare('INSERT INTO clients (name, context) VALUES (?, ?)');
            $stmt->execute([
                isset($data['name']) ? $data['name'] : '',
                isset($data['context']) ? $data['context'] : '',
            ]);
            respondJson(['id' => $pdo->lastInsertId()]);
        }

        if ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare('DELETE FROM clients WHERE id = ?');
            $stmt->execute([$id]);
            respondJson(['success' => true]);
        }

        if ($method === 'GET' && $id && $subResource === 'keywords') {
            $stmt = $pdo->prepare('SELECT * FROM keywords WHERE client_id = ? ORDER BY id DESC');
            $stmt->execute([$id]);
            respondJson($stmt->fetchAll());
        }

        if ($method === 'POST' && $id && $subResource === 'keywords' && $action === 'bulk') {
            $data = getRequestData();
            $keywords = isset($data['keywords']) ? $data['keywords'] : [];

            if (!is_array($keywords) || empty($keywords)) {
                respondJson([
                    'error' => 'Nenhuma palavra-chave recebida para salvar.',
                    'received_data' => $data,
                ], 400);
            }

            $stmt = $pdo->prepare('INSERT INTO keywords (client_id, keyword) VALUES (?, ?)');
            $savedCount = 0;

            foreach ($keywords as $kw) {
                $kw = trim((string) $kw);
                if ($kw === '') {
                    continue;
                }

                $stmt->execute([$id, $kw]);
                $savedCount++;
            }

            if ($savedCount === 0) {
                respondJson([
                    'error' => 'As palavras-chave recebidas estavam vazias.',
                    'received_data' => $data,
                ], 400);
            }

            respondJson(['success' => true, 'saved_count' => $savedCount]);
        }

        if ($method === 'GET' && $id && $subResource === 'regions') {
            $stmt = $pdo->prepare('SELECT * FROM regions WHERE client_id = ? ORDER BY id DESC');
            $stmt->execute([$id]);
            respondJson($stmt->fetchAll());
        }

        if ($method === 'POST' && $id && $subResource === 'regions' && $action === 'bulk') {
            $data = getRequestData();
            $regions = isset($data['regions']) ? $data['regions'] : [];

            if (!is_array($regions) || empty($regions)) {
                respondJson([
                    'error' => 'Nenhuma regiao recebida para salvar.',
                    'received_data' => $data,
                ], 400);
            }

            $stmt = $pdo->prepare('INSERT INTO regions (client_id, region) VALUES (?, ?)');
            $savedCount = 0;

            foreach ($regions as $reg) {
                $reg = trim((string) $reg);
                if ($reg === '') {
                    continue;
                }

                $stmt->execute([$id, $reg]);
                $savedCount++;
            }

            if ($savedCount === 0) {
                respondJson([
                    'error' => 'As regioes recebidas estavam vazias.',
                    'received_data' => $data,
                ], 400);
            }

            respondJson(['success' => true, 'saved_count' => $savedCount]);
        }

        if ($method === 'GET' && $id && $subResource === 'template') {
            $stmt = $pdo->prepare('SELECT template_content as content FROM clients WHERE id = ?');
            $stmt->execute([$id]);
            $result = $stmt->fetch();
            respondJson($result ? $result : ['content' => '']);
        }

        if ($method === 'POST' && $id && $subResource === 'template') {
            $data = getRequestData();
            $stmt = $pdo->prepare('UPDATE clients SET template_content = ? WHERE id = ?');
            $stmt->execute([
                isset($data['content']) ? $data['content'] : '',
                $id,
            ]);
            respondJson(['success' => true]);
        }

        if ($method === 'PUT' && $id && $subResource === 'whatsapp') {
            $data = getRequestData();
            $stmt = $pdo->prepare('UPDATE clients SET whatsapp_number = ?, whatsapp_message = ? WHERE id = ?');
            $stmt->execute([
                isset($data['whatsapp_number']) ? $data['whatsapp_number'] : null,
                isset($data['whatsapp_message']) ? $data['whatsapp_message'] : null,
                $id,
            ]);
            respondJson(['success' => true]);
        }
    }

    if ($resource === 'keywords' && $method === 'DELETE' && $id) {
        $stmt = $pdo->prepare('DELETE FROM keywords WHERE id = ?');
        $stmt->execute([$id]);
        respondJson(['success' => true]);
    }

    if ($resource === 'regions' && $method === 'DELETE' && $id) {
        $stmt = $pdo->prepare('DELETE FROM regions WHERE id = ?');
        $stmt->execute([$id]);
        respondJson(['success' => true]);
    }

    if ($resource === 'global-templates') {
        if ($method === 'GET') {
            $stmt = $pdo->query('SELECT * FROM global_templates ORDER BY id DESC');
            respondJson($stmt->fetchAll());
        }

        if ($method === 'POST') {
            $data = getRequestData();
            $stmt = $pdo->prepare('INSERT INTO global_templates (name, content) VALUES (?, ?)');
            $stmt->execute([
                isset($data['name']) ? $data['name'] : '',
                isset($data['content']) ? $data['content'] : '',
            ]);
            respondJson(['id' => $pdo->lastInsertId()]);
        }

        if ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare('DELETE FROM global_templates WHERE id = ?');
            $stmt->execute([$id]);
            respondJson(['success' => true]);
        }
    }

    respondJson(['error' => 'Endpoint not found', 'path' => $path], 404);
} catch (PDOException $e) {
    respondJson(['error' => 'Database error: ' . $e->getMessage()], 500);
} catch (Exception $e) {
    respondJson(['error' => 'Application error: ' . $e->getMessage()], 500);
}
?>
