<?php
// Arquivo para testar conexão com o banco
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Diagnóstico de Conexão</h2>";

if (file_exists('../db.php')) {
    $dbPath = '../db.php';
} elseif (file_exists('db.php')) {
    $dbPath = 'db.php';
} else {
    die("<p style='color:red'>Erro: Arquivo db.php não encontrado. Verifique se ele está na pasta raiz.</p>");
}

// Sobrescreve o die do db.php para não matar o teste
function json_die($msg) { echo "<p style='color:red'>Erro capturado do db.php: $msg</p>"; }

try {
    require_once $dbPath;
    
    if (isset($pdo)) {
        echo "<p style='color:green'>✅ Conexão com o banco estabelecida com sucesso!</p>";
        
        // Tenta listar tabelas
        $stmt = $pdo->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        echo "<h3>Tabelas Encontradas:</h3>";
        echo "<ul>";
        foreach ($tables as $table) {
            echo "<li>$table</li>";
        }
        echo "</ul>";
    }

} catch (Exception $e) {
    echo "<p style='color:red'>❌ Erro: " . $e->getMessage() . "</p>";
    echo "<hr>";
    echo "<p><strong>Dica:</strong> Se o erro for 'Connection timed out' ou 'Access denied', adicione seu IP atual no 'Remote MySQL' do cPanel da hospedagem.</p>";
}
?>