<?php
// Carregar variáveis de ambiente do .env
if (file_exists(__DIR__ . '/../.env')) {
    $env = parse_ini_file(__DIR__ . '/../.env');
    $dbHost = $env['DB_HOST'] ?? 'localhost';
    $dbUser = $env['DB_USER'] ?? 'root';
    $dbPassword = $env['DB_PASSWORD'] ?? '';
    $dbName = $env['DB_NAME'] ?? 'seo';
} else {
    // Fallback se .env não existir
    $dbHost = '162.241.2.49';
    $dbUser = 'abso7751_sistemaseo';
    $dbPassword = 'Ravxl!@#$%1';
    $dbName = 'abso7751_sistemaseo';
}

// Conexão com MySQL usando mysqli
$conn = new mysqli($dbHost, $dbUser, $dbPassword, $dbName);

// Verificar conexão
if ($conn->connect_error) {
    die("Erro na conexão: " . $conn->connect_error);
}

// Definir charset
$conn->set_charset("utf8");

// Função para executar queries (opcional)
function executeQuery($query, $params = []) {
    global $conn;
    $stmt = $conn->prepare($query);
    if ($params) {
        $types = str_repeat('s', count($params)); // Assume strings, ajuste se necessário
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt;
}

// Exemplo de uso:
// $result = executeQuery("SELECT * FROM clients");
// $rows = $result->get_result()->fetch_all(MYSQLI_ASSOC);
?>