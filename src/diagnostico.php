<?php
header('Content-Type: text/html; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Diagnóstico do Banco de Dados</h1>";

$dbPath = '../db.php';
if (!file_exists($dbPath)) {
    die("<p style='color:red'>Erro: Arquivo db.php não encontrado.</p>");
}

// Ignora o die() do db.php para este teste
function json_die($msg) { echo "<p style='color:red'>Erro de conexão: $msg</p>"; }

try {
    require_once $dbPath;
    
    if (!isset($pdo)) {
        throw new Exception("Variável \$pdo não definida após incluir db.php");
    }

    echo "<p style='color:green'>✅ Conexão estabelecida com sucesso!</p>";

    // Listar Tabelas
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($tables)) {
        echo "<p style='color:orange'>⚠ Nenhuma tabela encontrada no banco de dados.</p>";
    } else {
        echo "<h2>Estrutura Encontrada:</h2>";
        foreach ($tables as $table) {
            echo "<div style='border:1px solid #ccc; padding:10px; margin-bottom:10px;'>";
            echo "<h3>Tabela: <span style='color:blue'>$table</span></h3>";
            
            // Listar Colunas
            $stmtCols = $pdo->query("DESCRIBE `$table`");
            $columns = $stmtCols->fetchAll(PDO::FETCH_ASSOC);
            
            echo "<ul>";
            foreach ($columns as $col) {
                echo "<li><strong>{$col['Field']}</strong> ({$col['Type']})</li>";
            }
            echo "</ul>";
            
            // Verificar se há dados
            $count = $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
            echo "<p><em>Registros: $count</em></p>";
            echo "</div>";
        }
    }

} catch (Exception $e) {
    echo "<div style='background:#fee; border:1px solid red; padding:15px;'>";
    echo "<h2>❌ Falha na Conexão</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
    echo "<hr>";
    echo "<p><strong>Soluções Possíveis:</strong></p>";
    echo "<ul><li>Vá no cPanel da hospedagem > <strong>Remote MySQL</strong> e adicione seu IP atual.</li>";
    echo "<li>Verifique se o usuário e senha no arquivo <code>db.php</code> estão corretos.</li></ul>";
    echo "</div>";
}
?>