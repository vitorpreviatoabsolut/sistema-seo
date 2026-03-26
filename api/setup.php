<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/html; charset=utf-8');

require_once '../db.php';

echo "<h1>Configuracao Automatica do Banco de Dados</h1>";

try {
    $sql = "CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        context TEXT,
        whatsapp_number VARCHAR(50),
        whatsapp_message TEXT,
        template_content LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>Tabela <strong>clients</strong> verificada/criada.</p>";

    $sql = "CREATE TABLE IF NOT EXISTS keywords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>Tabela <strong>keywords</strong> verificada/criada.</p>";

    $sql = "CREATE TABLE IF NOT EXISTS regions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        region VARCHAR(255) NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>Tabela <strong>regions</strong> verificada/criada.</p>";

    $sql = "CREATE TABLE IF NOT EXISTS global_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>Tabela <strong>global_templates</strong> verificada/criada.</p>";

    $sql = "CREATE TABLE IF NOT EXISTS templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL UNIQUE,
        content LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>Tabela <strong>templates</strong> verificada/criada.</p>";

    $sql = "CREATE TABLE IF NOT EXISTS generation_jobs (
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
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>Tabela <strong>generation_jobs</strong> verificada/criada.</p>";

    echo "<hr><h2 style='color:green'>Tudo pronto. O banco de dados esta configurado corretamente.</h2>";
    echo "<p>Agora voce pode voltar ao sistema e testar a geracao com pausa e retomada.</p>";
} catch (PDOException $e) {
    echo "<h2 style='color:red'>Erro na configuracao:</h2>";
    echo "<p>" . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . "</p>";

    if (strpos($e->getMessage(), 'Column') !== false) {
        echo "<p><strong>Dica:</strong> Se as tabelas antigas estiverem vazias, recrie-as com os campos atuais antes de rodar o sistema.</p>";
    }
}
?>
