<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Carregar .env
$env = parse_ini_file(__DIR__ . '/.env');

include 'db.php';

// Função auxiliar para enviar resposta JSON
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Função auxiliar para obter dados POST
function getPostData() {
    return json_decode(file_get_contents('php://input'), true);
}

// Router simples
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Quebrar em segmentos e remover qualquer prefixo antes de /api
$pathParts = array_values(array_filter(explode('/', trim($path, '/'))));
$apiIndex = array_search('api', $pathParts, true);
if ($apiIndex !== false) {
    $pathParts = array_slice($pathParts, $apiIndex + 1);
}

$path = implode('/', $pathParts);

try {
    switch ($path) {
        case 'check-key':
            if ($requestMethod === 'GET') {
                $apiKey = $env['GEMINI_API_KEY'] ?? '';
                sendResponse([
                    'hasKey' => !empty($apiKey),
                    'length' => strlen($apiKey),
                    'prefix' => !empty($apiKey) ? substr($apiKey, 0, 5) : null
                ]);
            }
            break;

        case 'clients':
            if ($requestMethod === 'GET') {
                $result = executeQuery("SELECT * FROM clients");
                $rows = $result->get_result()->fetch_all(MYSQLI_ASSOC);
                sendResponse($rows);
            } elseif ($requestMethod === 'POST') {
                $data = getPostData();
                $name = $data['name'] ?? '';
                $context = $data['context'] ?? '';
                $result = executeQuery("INSERT INTO clients (name, context) VALUES (?, ?)", [$name, $context]);
                sendResponse(['id' => $conn->insert_id, 'name' => $name, 'context' => $context]);
            }
            break;

        case (preg_match('/^clients\/(\d+)$/', $path, $matches) ? $path : null):
            $clientId = $matches[1];
            if ($requestMethod === 'DELETE') {
                executeQuery("DELETE FROM clients WHERE id = ?", [$clientId]);
                sendResponse(['success' => true]);
            }
            break;

        case (preg_match('/^clients\/(\d+)\/keywords$/', $path, $matches) ? $path : null):
            $clientId = $matches[1];
            if ($requestMethod === 'GET') {
                $result = executeQuery("SELECT * FROM keywords WHERE client_id = ?", [$clientId]);
                $rows = $result->get_result()->fetch_all(MYSQLI_ASSOC);
                sendResponse($rows);
            } elseif ($requestMethod === 'POST') {
                $data = getPostData();
                $keyword = $data['keyword'] ?? '';
                $result = executeQuery("INSERT INTO keywords (client_id, keyword) VALUES (?, ?)", [$clientId, $keyword]);
                sendResponse(['id' => $conn->insert_id, 'client_id' => $clientId, 'keyword' => $keyword]);
            }
            break;

        case (preg_match('/^keywords\/(\d+)$/', $path, $matches) ? $path : null):
            $keywordId = $matches[1];
            if ($requestMethod === 'DELETE') {
                executeQuery("DELETE FROM keywords WHERE id = ?", [$keywordId]);
                sendResponse(['success' => true]);
            }
            break;

        case (preg_match('/^clients\/(\d+)\/regions$/', $path, $matches) ? $path : null):
            $clientId = $matches[1];
            if ($requestMethod === 'GET') {
                $result = executeQuery("SELECT * FROM regions WHERE client_id = ?", [$clientId]);
                $rows = $result->get_result()->fetch_all(MYSQLI_ASSOC);
                sendResponse($rows);
            } elseif ($requestMethod === 'POST') {
                $data = getPostData();
                $region = $data['region'] ?? '';
                $result = executeQuery("INSERT INTO regions (client_id, region) VALUES (?, ?)", [$clientId, $region]);
                sendResponse(['id' => $conn->insert_id, 'client_id' => $clientId, 'region' => $region]);
            }
            break;

        case (preg_match('/^regions\/(\d+)$/', $path, $matches) ? $path : null):
            $regionId = $matches[1];
            if ($requestMethod === 'DELETE') {
                executeQuery("DELETE FROM regions WHERE id = ?", [$regionId]);
                sendResponse(['success' => true]);
            }
            break;

        case (preg_match('/^clients\/(\d+)\/template$/', $path, $matches) ? $path : null):
            $clientId = $matches[1];
            if ($requestMethod === 'GET') {
                $result = executeQuery("SELECT * FROM templates WHERE client_id = ?", [$clientId]);
                $rows = $result->get_result()->fetch_all(MYSQLI_ASSOC);
                sendResponse($rows[0] ?? ['content' => '']);
            } elseif ($requestMethod === 'POST') {
                $data = getPostData();
                $content = $data['content'] ?? '';
                executeQuery("INSERT INTO templates (client_id, content) VALUES (?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)", [$clientId, $content]);
                sendResponse(['success' => true]);
            }
            break;

        case 'global-templates':
            if ($requestMethod === 'GET') {
                $result = executeQuery("SELECT * FROM global_templates");
                $rows = $result->get_result()->fetch_all(MYSQLI_ASSOC);
                sendResponse($rows);
            } elseif ($requestMethod === 'POST') {
                $data = getPostData();
                $name = $data['name'] ?? '';
                $content = $data['content'] ?? '';
                $result = executeQuery("INSERT INTO global_templates (name, content) VALUES (?, ?)", [$name, $content]);
                sendResponse(['id' => $conn->insert_id, 'name' => $name, 'content' => $content]);
            }
            break;

        case (preg_match('/^global-templates\/(\d+)$/', $path, $matches) ? $path : null):
            $templateId = $matches[1];
            if ($requestMethod === 'DELETE') {
                executeQuery("DELETE FROM global_templates WHERE id = ?", [$templateId]);
                sendResponse(['success' => true]);
            }
            break;

        default:
            sendResponse(['error' => 'Rota não encontrada'], 404);
    }
} catch (Exception $e) {
    sendResponse(['error' => $e->getMessage()], 500);
}
?>