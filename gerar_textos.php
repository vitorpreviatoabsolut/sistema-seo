<?php
// Aumenta o tempo limite de execução para 5 minutos (geração pode demorar)
set_time_limit(300);

require_once '../db.php';

// Configurações de CORS e Header
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Recebe os dados
$input = json_decode(file_get_contents('php://input'), true);
$clientId = isset($input['client_id']) ? $input['client_id'] : null;
$apiKey = isset($input['api_key']) ? $input['api_key'] : null;

if (!$clientId || !$apiKey) {
    http_response_code(400);
    echo json_encode(['error' => 'client_id e api_key são obrigatórios']);
    exit;
}

try {
    // 1. Buscar dados do cliente
    $stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$clientId]);
    $client = $stmt->fetch();

    if (!$client) {
        throw new Exception("Cliente não encontrado");
    }

    // 2. Buscar palavras-chave
    $stmt = $pdo->prepare("SELECT keyword FROM keywords WHERE client_id = ?");
    $stmt->execute([$clientId]);
    $keywords = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($keywords)) {
        throw new Exception("Nenhuma palavra-chave encontrada para este cliente");
    }

    // 3. Buscar regiões
    $stmt = $pdo->prepare("SELECT region FROM regions WHERE client_id = ?");
    $stmt->execute([$clientId]);
    $regions = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Se não houver regiões, cria um array com string vazia para rodar o loop pelo menos uma vez
    if (empty($regions)) {
        $regions = [''];
    }

    // 4. Preparar o ZIP
    $zip = new ZipArchive();
    $downloadsDir = '../downloads';
    if (!is_dir($downloadsDir)) {
        mkdir($downloadsDir, 0755, true);
    }
    
    $zipFilename = "textos-seo-" . preg_replace('/[^a-z0-9]/i', '-', strtolower($client['name'])) . "-" . time() . ".zip";
    $zipPath = $downloadsDir . '/' . $zipFilename;

    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        throw new Exception("Não foi possível criar o arquivo ZIP");
    }

    $generatedCount = 0;

    // 5. Loop de Geração
    foreach ($keywords as $keyword) {
        foreach ($regions as $region) {
            $regionText = $region ? " em $region" : "";
            $regionPrompt = $region ? " na região de '$region'" : "";
            
            // Prompt alinhado com o App.tsx
            $prompt = "Você é um Especialista Sênior em SEO e Copywriting. Escreva um texto completo sobre '$keyword'$regionPrompt.\n";
            $prompt .= "Cliente: '{$client['name']}'. Contexto: '{$client['context']}'.\n";
            $prompt .= "Retorne APENAS um JSON com: { \"metaDescription\": \"...\", \"seoText\": \"...HTML content...\" }";

            // Chamada à API Gemini via cURL
            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $apiKey;
            
            $data = [
                "contents" => [
                    ["parts" => [["text" => $prompt]]]
                ],
                "generationConfig" => [
                    "responseMimeType" => "application/json"
                ]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                continue; // Pula se der erro neste item
            }

            $jsonResponse = json_decode($response, true);
            $contentRaw = isset($jsonResponse['candidates'][0]['content']['parts'][0]['text']) ? $jsonResponse['candidates'][0]['content']['parts'][0]['text'] : null;

            if ($contentRaw) {
                $contentObj = json_decode($contentRaw, true);
                $seoText = isset($contentObj['seoText']) ? $contentObj['seoText'] : $contentRaw;
                $metaDesc = isset($contentObj['metaDescription']) ? $contentObj['metaDescription'] : '';

                // Prepara o conteúdo do arquivo final (usando o template salvo no banco ou padrão)
                $templateContent = isset($client['template_content']) && !empty($client['template_content']) ? $client['template_content'] : '<!DOCTYPE html><html><body><h1>{{TITLE}}</h1>{{SEO_TEXT}}</body></html>';
                
                $title = "$keyword$regionText - {$client['name']}";
                $safeKeyword = preg_replace('/[^a-z0-9]+/', '-', strtolower($keyword));
                $safeRegion = preg_replace('/[^a-z0-9]+/', '-', strtolower($region));
                $filename = $safeRegion ? "$safeKeyword-$safeRegion.php" : "$safeKeyword.php";

                // Substituições
                $finalContent = str_replace(
                    ['{{SEO_TEXT}}', '{{TITLE}}', '{{DESCRIPTION}}', '{{KEYWORD}}', '{{REGION}}'],
                    [$seoText, $title, $metaDesc, $keyword, $region],
                    $templateContent
                );

                $zip->addFromString($filename, $finalContent);
                $generatedCount++;
            }

            // Pequeno delay para evitar rate limit
            usleep(500000); // 0.5s
        }
    }

    $zip->close();

    if ($generatedCount === 0) {
        throw new Exception("Nenhum texto foi gerado com sucesso.");
    }

    echo json_encode([
        'success' => true,
        'generated_count' => $generatedCount,
        'download_url' => '/downloads/' . $zipFilename
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>