<?php

        $title       = "Teste seu site no google em Alphaville - Absolut SBO";
        $description = "Melhore sua visibilidade online! Faça o teste seu site no Google em Alphaville com a Absolut SBO. Otimize sua performance e atraia leads. Agende agora!"; 
        $h1          = $title;
        $keywords    = $title;
        
        // CONFIGURAÇÃO DA IMAGEM (SEO: Imagem relevante para o termo)
        $imagem_capa = $url . "imagens/pages/palavra-chave.jpg"; 

        include "includes/padrao/class.padrao.php"; 
        include "includes/config.php"; 
        include "includes/padrao/head.padrao.php";
        
        $url_title   = $padrao->formatStringToURL($title);
        
        // CSS Crítico
        $padrao->compressCSS(array(
            "default_padrao/direitos-texto",
            "default_padrao/landing",
            "default_padrao/veja-tambem",
            "default_padrao/sidebar",
            "default_padrao/regioes",
            "palavra-chave"
        ));
    ?>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --cor-primary: #25d366; /* Verde WhatsApp */
            --cor-dark: #075e54;
            --cor-bg: #f8f9fa;
            --cor-text: #4a4a4a;
        }

        body {
            font-family: 'Open Sans', sans-serif;
            background-color: var(--cor-bg);
            color: var(--cor-text);
            line-height: 1.6;
        }

        /* --- HERO SECTION OTIMIZADA --- */
        .hero-wrapper {
            position: relative;
            height: 400px;
            background-image: url('<?php echo $imagem_capa; ?>');
            background-size: cover;
            background-position: center;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .hero-overlay {
            position: absolute; top:0; left:0; width:100%; height:100%;
            background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%);
        }
        .hero-title {
            position: relative; z-index: 2; text-align: center; color: #fff; padding: 20px;
            max-width: 800px;
        }
        .hero-title h1 {
            font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 2.5rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5); margin: 0;
        }

        /* --- CARD DE CONTEÚDO (SEO SILO) --- */
        .content-card {
            background: #fff;
            max-width: 900px;
            margin: -60px auto 40px auto; /* Sobreposição elegante */
            padding: 0px 50px 40px 50px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            position: relative; z-index: 10;
        }
        
        /* Breadcrumbs (Vital para SEO) */
        .seo-breadcrumbs {
            font-size: 0.85rem; color: #888; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .seo-breadcrumbs a { color: #888; text-decoration: none; }
        .seo-breadcrumbs a:hover { color: var(--cor-primary); }

        /* Tipografia do Conteúdo */
        .article-content { font-size: 1.1rem; color: #333; text-align: left; }
        .article-content h2, .article-content h3 {
            font-family: 'Montserrat', sans-serif; color: var(--cor-dark); margin-top: 1.5em;
        }
        .article-content ul { padding-left: 20px; margin-bottom: 20px; }
        .article-content li { margin-bottom: 8px; }

        /* --- CONVERSÃO (CTA) --- */
        .cta-inline {
            background: #e9f7ef; border-left: 5px solid var(--cor-primary);
            padding: 20px; margin: 30px 0; border-radius: 4px;
        }
        .cta-inline h3 { margin-top: 0; color: var(--cor-dark); font-size: 1.3rem; }
        
        .btn-whatsapp-main {
    display: block;
    background: var(--cor-primary);
    color: #fff !important;
    padding: 12px 30px;
    border-radius: 50px;
    font-weight: bold;
    text-decoration: none !important;
    margin-top: 10px;
    transition: transform 0.2s;
    box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);
    width: 100%;
    text-wrap: no-wrap;
}
        .btn-whatsapp-main:hover { transform: translateY(-2px); background: #1ebe57; }

        /* --- SEO GEO & LINKAGEM INTERNA --- */
        .geo-section {
            background: #fff; padding: 40px 0; border-top: 1px solid #eee; margin-top: 40px;
        }
        .geo-title {
            text-align: center; font-family: 'Montserrat', sans-serif; font-weight: 600;
            margin-bottom: 30px; color: #555; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px;
        }
        
        /* Estilização dos includes antigos para ficarem bonitos */
        .lista-regioes ul, .lista-veja-tambem ul {
            list-style: none; padding: 0; text-align: center;
        }
        .lista-regioes li, .lista-veja-tambem li {
            display: inline-block; margin: 5px 10px; font-size: 0.9rem;
        }
        .lista-regioes a, .lista-veja-tambem a {
            color: #666; text-decoration: none; border-bottom: 1px solid #ddd; transition: 0.2s;
        }
        .lista-regioes a:hover { color: var(--cor-primary); border-color: var(--cor-primary); }

        /* Mobile Adjustments */
        @media(max-width: 768px) {
            .content-card { padding: 25px; margin-top: -30px; border-radius: 15px 15px 0 0; }
            .hero-title h1 { font-size: 1.8rem; }
            .hero-wrapper { height: 300px; }
        }
        
        /* Botão Flutuante */
        .float-wap {
            position: fixed; bottom: 25px; right: 25px; width: 60px; height: 60px;
            background: #25d366; color: white !important; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; font-size: 30px;
            box-shadow: 2px 2px 10px rgba(0,0,0,0.2); z-index: 9999;
        }
    </style>
    </head>
    <body>
        
        <?php include "includes/_header.php"; ?>
        
        <main>
            
            <section class="hero-wrapper">
                <div class="hero-overlay"></div>
                <div class="hero-title">
                    <h1>Teste seu site no google em Alphaville</h1>
                    <p style="font-size: 1.1rem; margin-top: 15px; opacity: 0.9;">
                        Soluções especializadas em Teste seu site no google em Alphaville
                    </p>
                    <div class="row hidden-xs" style="margin-bottom: 30px; align-items: center;">
                             <div class="col-md-12 text-center">
                                <a href="https://wa.me/11940308221?text=Ol%C3%A1%2C%20teste%20de%20mensagem" class="btn-whatsapp-main" style="width: 100%;">
                                    <i class="fab fa-whatsapp"></i> Orçamento para Teste seu site no google
                                </a>
                             </div>
                        </div>
                </div>
            </section>

            <div class="container">
                <div class="content-card">
                    
                    <div class="seo-breadcrumbs">
                        <?php echo $padrao->breadcrumb(array($title)); ?>
                    </div>

                    <article class="article-content">
                        
                        

                        <h2>A importância de realizar o teste seu site no Google em Alphaville</h2><p>No cenário corporativo altamente competitivo de <strong>Alphaville</strong>, ter apenas uma vitrine virtual não é suficiente. Para que sua empresa se destaque e alcance as primeiras posições, é fundamental que a experiência do usuário seja impecável e tecnicamente otimizada. Realizar o <strong>teste seu site no Google em Alphaville</strong> é o primeiro passo para diagnosticar falhas de carregamento, problemas de responsividade e erros de SEO que podem estar afastando potenciais clientes do seu negócio.</p><h2>Como a Absolut SBO transforma sua presença digital</h2><p>A Absolut SBO é uma agência de marketing 360º focada na excelência e em resultados reais. Liderada pelo casal empreendedor Paulo Camargo e Melli Camargo, nossa equipe entende que a performance técnica é a base do sucesso orgânico. Ao solicitar um <strong>teste seu site no Google em Alphaville</strong> através dos nossos especialistas, você recebe um diagnóstico completo para se livrar de amarras técnicas e garantir que sua empresa alcance <strong>leads qualificados</strong> com maior visibilidade.</p><h3>O que analisamos no teste de performance?</h3><ul><li><strong>Velocidade de Carregamento:</strong> Sites lentos perdem posições no ranking e elevam a taxa de rejeição.</li><li><strong>Mobile First:</strong> Verificamos se sua página é totalmente otimizada para smartphones e tablets.</li><li><strong>Core Web Vitals:</strong> Avaliamos as métricas fundamentais que o Google utiliza para classificar a qualidade da sua página.</li><li><strong>SEO On-Page:</strong> Analisamos títulos, metatags e a hierarquia de informações.</li></ul><h2>Estratégias inteligentes para o crescimento em Alphaville</h2><p>Localizada estrategicamente em Guarulhos e no renomado bairro de <strong>Alphaville</strong>, a Absolut SBO oferece soluções variadas que englobam aquisição, gestão, programação e audiovisual. Quando você decide realizar o <strong>teste seu site no Google em Alphaville</strong> conosco, não está apenas olhando para números, mas sim investindo em uma estratégia inteligente de crescimento que visa dominar o mercado digital local e nacional.</p><h3>Pronto para subir de nível e atrair mais leads?</h3><p>Não permita que problemas invisíveis impeçam o sucesso da sua marca na internet. Aumentar sua relevância nos buscadores exige técnica, monitoramento constante e o suporte de quem entende de performance. Convidamos você a <a href="#">agendar a sua reunião</a> hoje mesmo e descobrir como o <strong>teste seu site no Google em Alphaville</strong> pode ser o ponto de partida para uma nova fase de prosperidade para sua empresa.</p>
                        
                        <div class="cta-inline">
                            <div class="row">
                                <div class="col-md-8">
                                    <h3>Precisa de <?php echo $title; ?>?</h3>
                                    <p style="margin-bottom:0;">Fale com nossa equipe técnica agora mesmo pelo WhatsApp.</p>
                                </div>
                                <div class="col-md-4 text-center">
                                    <a href="https://wa.me/11940308221?text=Ol%C3%A1%2C%20teste%20de%20mensagem" class="btn-whatsapp-main">
                                        <i class="fab fa-whatsapp"></i> Conversar Agora
                                    </a>
                                </div>
                            </div>
                        </div>

                    </article>

                </div>
            </div>




            <?php include "includes/direitos-texto.php"; ?>

            

        </main>
        
        <?php include "includes/_footer.php"; ?>
        
        <?php $padrao->compressJS(array(
            "tools/jquery.fancybox",
            "tools/bootstrap.min",
            "tools/jquery.validate.min",
            "tools/jquery.mask.min",
            "jquery.padrao.keyword"
        )); ?>
        
    </body>
    </html>