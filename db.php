<?php
// Carregar variaveis de ambiente do .env se existir.
if (file_exists(__DIR__ . '/.env')) {
    $env = [];
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || $line[0] === '#') {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $val = trim($parts[1]);

        if (
            strlen($val) > 1 &&
            ($val[0] === '"' || $val[0] === "'") &&
            $val[0] === $val[strlen($val) - 1]
        ) {
            $val = substr($val, 1, -1);
        }

        $env[$key] = $val;
    }

    $dbHost = isset($env['DB_HOST']) ? $env['DB_HOST'] : 'localhost';
    $dbPort = isset($env['DB_PORT']) ? $env['DB_PORT'] : '3306';
    $dbUser = isset($env['DB_USER']) ? $env['DB_USER'] : 'root';
    $dbPassword = isset($env['DB_PASSWORD']) ? $env['DB_PASSWORD'] : '';
    $dbName = isset($env['DB_NAME']) ? $env['DB_NAME'] : 'seo';
} else {
    // Fallback: conexao direta caso o .env nao exista.
    $dbHost = '162.241.2.49';
    $dbPort = '3306';
    $dbUser = 'abso7751_sistemaseo';
    $dbPassword = 'Ravxl!@#$%1';
    $dbName = 'abso7751_sistemaseo';
}

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";

    $pdo = new PDO($dsn, $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 10,
    ]);
} catch (PDOException $e) {
    $message = $e->getMessage();

    if (stripos($message, 'Connection timed out') !== false) {
        $message .= ' Verifique se seu IP esta liberado em Remote MySQL no cPanel da HostGator.';
    } elseif (stripos($message, 'Access denied') !== false) {
        $message .= ' Revise host, usuario, senha e permissoes do usuario no banco remoto.';
    } elseif (stripos($message, 'php_network_getaddresses') !== false) {
        $message .= ' O host configurado parece invalido ou nao esta resolvendo DNS.';
    }

    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    die(json_encode(['error' => 'Erro na conexao com o banco de dados: ' . $message]));
}
?>
