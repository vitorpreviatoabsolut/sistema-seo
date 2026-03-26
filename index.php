<?php
// Inclui a conexão com o banco (ajuste o caminho se db.php estiver em outro lugar)
if (file_exists('../db.php')) {
    require_once '../db.php';
} else {
    require_once 'db.php';
}

// Configurações de Header e CORS
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Função auxiliar para pegar dados JSON do corpo da requisição
function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// Roteamento simples
$scriptName = $_SERVER['SCRIPT_NAME'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptDir = dirname($scriptName);

// Remove o diretório base da URI para pegar o caminho relativo (ex: /clients)
$path = str_replace(str_replace('\\', '/', $scriptDir), '', $requestUri);
// Correção: Remove index.php do início do caminho se estiver presente (comum em alguns setups do XAMPP)
$path = preg_replace('/^[\/]?index\.php\//', '', $path);
$path = trim($path, '/');
$parts = explode('/', $path);

$resource = isset($parts[0]) ? $parts[0] : ''; // ex: clients
$id = isset($parts[1]) ? $parts[1] : null;     // ex: 1
$subResource = isset($parts[2]) ? $parts[2] : null; // ex: keywords
$action = isset($parts[3]) ? $parts[3] : null; // ex: bulk

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($resource === 'clients') {
        if ($method === 'GET' && !$id) {
            // Listar Clientes
            $stmt = $pdo->query("SELECT * FROM clients ORDER BY id DESC");
            echo json_encode($stmt->fetchAll());
        } 
        elseif ($method === 'POST' && !$id) {
            // Criar Cliente
            $data = getJsonInput();
            $stmt = $pdo->prepare("INSERT INTO clients (name, context) VALUES (?, ?)");
            $stmt->execute([$data['name'], isset($data['context']) ? $data['context'] : '']);
            echo json_encode(['id' => $pdo->lastInsertId()]);
        }
        elseif ($method === 'DELETE' && $id) {
            // Deletar Cliente
            $stmt = $pdo->prepare("DELETE FROM clients WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
        elseif ($method === 'GET' && $id && $subResource === 'keywords') {
            // Listar Palavras-chave do Cliente
            $stmt = $pdo->prepare("SELECT * FROM keywords WHERE client_id = ? ORDER BY id DESC");
            $stmt->execute([$id]);
            echo json_encode($stmt->fetchAll());
        }
        elseif ($method === 'POST' && $id && $subResource === 'keywords' && $action === 'bulk') {
            // Adicionar Palavras-chave em Massa
            $data = getJsonInput();
            $keywords = isset($data['keywords']) ? $data['keywords'] : [];
            $stmt = $pdo->prepare("INSERT INTO keywords (client_id, keyword) VALUES (?, ?)");
            foreach ($keywords as $kw) {
                $stmt->execute([$id, $kw]);
            }
            echo json_encode(['success' => true]);
        }
        elseif ($method === 'GET' && $id && $subResource === 'regions') {
            // Listar Regiões do Cliente
            $stmt = $pdo->prepare("SELECT * FROM regions WHERE client_id = ? ORDER BY id DESC");
            $stmt->execute([$id]);
            echo json_encode($stmt->fetchAll());
        }
        elseif ($method === 'POST' && $id && $subResource === 'regions' && $action === 'bulk') {
            // Adicionar Regiões em Massa
            $data = getJsonInput();
            $regions = isset($data['regions']) ? $data['regions'] : [];
            $stmt = $pdo->prepare("INSERT INTO regions (client_id, region) VALUES (?, ?)");
            foreach ($regions as $reg) {
                $stmt->execute([$id, $reg]);
            }
            echo json_encode(['success' => true]);
        }
        elseif ($method === 'GET' && $id && $subResource === 'template') {
            // Pegar Template do Cliente
            $stmt = $pdo->prepare("SELECT template_content as content FROM clients WHERE id = ?");
            $stmt->execute([$id]);
            $result = $stmt->fetch();
            echo json_encode($result ?: ['content' => '']);
        }
        elseif ($method === 'POST' && $id && $subResource === 'template') {
            // Salvar Template do Cliente
            $data = getJsonInput();
            $stmt = $pdo->prepare("UPDATE clients SET template_content = ? WHERE id = ?");
            $stmt->execute([$data['content'], $id]);
            echo json_encode(['success' => true]);
        }
        elseif ($method === 'PUT' && $id && $subResource === 'whatsapp') {
            // Salvar Configuração WhatsApp
            $data = getJsonInput();
            $stmt = $pdo->prepare("UPDATE clients SET whatsapp_number = ?, whatsapp_message = ? WHERE id = ?");
            $stmt->execute([isset($data['whatsapp_number']) ? $data['whatsapp_number'] : null, isset($data['whatsapp_message']) ? $data['whatsapp_message'] : null, $id]);
            echo json_encode(['success' => true]);
        }
    }
    elseif ($resource === 'keywords') {
        if ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare("DELETE FROM keywords WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    }
    elseif ($resource === 'regions') {
        if ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare("DELETE FROM regions WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    }
    elseif ($resource === 'global-templates') {
        if ($method === 'GET') {
            $stmt = $pdo->query("SELECT * FROM global_templates ORDER BY id DESC");
            echo json_encode($stmt->fetchAll());
        }
        elseif ($method === 'POST') {
            $data = getJsonInput();
            $stmt = $pdo->prepare("INSERT INTO global_templates (name, content) VALUES (?, ?)");
            $stmt->execute([$data['name'], $data['content']]);
            echo json_encode(['id' => $pdo->lastInsertId()]);
        }
        elseif ($method === 'DELETE' && $id) {
            $stmt = $pdo->prepare("DELETE FROM global_templates WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    }
    else {
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found', 'path' => $path]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>