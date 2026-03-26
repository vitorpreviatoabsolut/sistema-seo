<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/html; charset=utf-8');

require_once '../db.php';

echo "<h1>Configuração Automática do Banco de Dados</h1>";

try {
    // 1. Tabela Clients
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
    echo "<p>✅ Tabela <strong>clients</strong> verificada/criada.</p>";

    // 2. Tabela Keywords
    $sql = "CREATE TABLE IF NOT EXISTS keywords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>✅ Tabela <strong>keywords</strong> verificada/criada.</p>";

    // 3. Tabela Regions
    $sql = "CREATE TABLE IF NOT EXISTS regions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        region VARCHAR(255) NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>✅ Tabela <strong>regions</strong> verificada/criada.</p>";

    // 4. Tabela Global Templates
    $sql = "CREATE TABLE IF NOT EXISTS global_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    $pdo->exec($sql);
    echo "<p>✅ Tabela <strong>global_templates</strong> verificada/criada.</p>";

    echo "<hr><h2 style='color:green'>Tudo pronto! O banco de dados está configurado corretamente.</h2>";
    echo "<p>Agora você pode voltar ao sistema e tentar salvar os dados.</p>";

} catch (PDOException $e) {
    echo "<h2 style='color:red'>Erro na configuração:</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
    
    // Diagnóstico extra para colunas
    if (strpos($e->getMessage(), 'Column') !== false) {
        echo "<p><strong>Dica:</strong> Parece que suas tabelas já existem mas com nomes de colunas diferentes. 
        Recomenda-se apagar as tabelas antigas pelo PHPMyAdmin se elas estiverem vazias, ou renomear as colunas para: 
        <code>name</code>, <code>context</code> (tabela clients).</p>";
    }
}
?>