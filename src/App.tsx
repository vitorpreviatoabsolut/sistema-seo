import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Download, Play, Pause, FileText, MapPin, Key, Users, Settings, Loader2, MessageCircle, Save, FolderOpen } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { saveAs } from 'file-saver';

interface Client {
  id: number;
  name: string;
  nome?: string;
  context: string;
  descricao?: string;
  whatsapp_number?: string;
  whatsapp_message?: string;
}

interface Keyword {
  id: number;
  keyword: string;
}

interface Region {
  id: number;
  region: string;
}

interface GlobalTemplate {
  id: number;
  name: string;
  content: string;
}

interface GenerationItem {
  index: number;
  keyword: string;
  region: string;
  filename: string;
}

interface JobConfig {
  template: string;
  client_name: string;
  client_context: string;
  whatsapp_number: string;
  whatsapp_message: string;
}

interface JobStatus {
  id: string;
  status: string;
  progress: number;
  total: number;
  message: string;
  downloadUrl: string;
  zipFilename: string;
  completedIndexes: number[];
  items: GenerationItem[];
  config: JobConfig;
}

const getApiBaseUrl = () => {
  const configuredBase = (import.meta as any).env?.VITE_API_BASE_URL?.trim();
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const isLocalConfiguredBase = configuredBase
    ? /:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\b/i.test(configuredBase)
    : false;

  if (configuredBase && !isLocalConfiguredBase) {
    return configuredBase.replace(/\/+$/, '');
  }

  const { origin } = window.location;

  if (isLocalHost) {
    return 'http://localhost/vitorpreviato.com.br/sistema-seo/api';
  }

  return `${origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();
const AUTO_PAUSE_BATCH_SIZE = 2498;
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>{{TITLE}}</title>
  <meta name="description" content="{{DESCRIPTION}}">
</head>
<body>
  <main>
    <h1>{{TITLE}}</h1>
    {{SEO_TEXT}}
  </main>
</body>
</html>`;

const apiFetch = (path: string, init?: RequestInit) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${normalizedPath}`, init);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Erro desconhecido';
  }
};

const isRetryableGenerationError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('429') ||
    normalized.includes('503') ||
    normalized.includes('unavailable') ||
    normalized.includes('high demand') ||
    normalized.includes('overloaded') ||
    normalized.includes('rate limit')
  );
};

const parseApiError = async (response: Response, fallbackMessage: string) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    return data?.error || fallbackMessage;
  }

  const text = await response.text();
  return text || fallbackMessage;
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'arquivo';

const buildGenerationItems = (keywords: Keyword[], regions: Region[]) => {
  const regionsToProcess = regions.length > 0 ? regions : [{ id: 0, region: '' }];
  const items: GenerationItem[] = [];
  let index = 0;

  for (const kw of keywords) {
    for (const reg of regionsToProcess) {
      const safeKeyword = slugify(kw.keyword);
      const safeRegion = reg.region ? slugify(reg.region) : '';

      items.push({
        index,
        keyword: kw.keyword,
        region: reg.region,
        filename: safeRegion ? `${safeKeyword}-${safeRegion}.php` : `${safeKeyword}.php`,
      });

      index += 1;
    }
  }

  return items;
};

const normalizeJobStatus = (job: any): JobStatus => ({
  id: String(job.id),
  status: String(job.status || 'paused'),
  progress: Number(job.progress || job.generated_count || 0),
  total: Number(job.total || 0),
  message: String(job.message || ''),
  downloadUrl: String(job.download_url || ''),
  zipFilename: String(job.zip_filename || 'textos-seo.zip'),
  completedIndexes: Array.isArray(job.completed_indexes) ? job.completed_indexes.map((value: any) => Number(value)) : [],
  items: Array.isArray(job.items) ? job.items : [],
  config: {
    template: String(job.config?.template || ''),
    client_name: String(job.config?.client_name || ''),
    client_context: String(job.config?.client_context || ''),
    whatsapp_number: String(job.config?.whatsapp_number || ''),
    whatsapp_message: String(job.config?.whatsapp_message || ''),
  },
});

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientContext, setNewClientContext] = useState('');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [template, setTemplate] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [globalTemplates, setGlobalTemplates] = useState<GlobalTemplate[]>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const pauseRequestedRef = useRef(false);
  const templateRequestRef = useRef(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchClients();
    fetchGlobalTemplates();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      setTemplate('');
      fetchKeywords(selectedClient.id);
      fetchRegions(selectedClient.id);
      fetchTemplate(selectedClient.id);
      fetchGenerationJob(selectedClient.id);
      setWhatsappNumber(selectedClient.whatsapp_number || '');
      setWhatsappMessage(selectedClient.whatsapp_message || '');
      setIsContextExpanded(false);
    } else {
      setJobStatus(null);
      setIsGenerating(false);
      setIsContextExpanded(false);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const res = await apiFetch('/clients');
      const contentType = res.headers.get('content-type');

      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Resposta não JSON da API:', text);
        throw new Error('A API retornou um erro HTML. Verifique o console.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro na API');
      }

      setClients(data);
    } catch (error: any) {
      console.error('Erro no fetchClients:', error);
      showToast(error.message || 'Erro ao conectar com o servidor.', 'error');
    }
  };

  const fetchGlobalTemplates = async () => {
    const res = await apiFetch('/global-templates');
    const data = await res.json();
    setGlobalTemplates(data);
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    try {
      const res = await apiFetch('/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName, context: newClientContext })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar cliente');
      }

      setNewClientName('');
      setNewClientContext('');
      fetchClients();
      showToast('Cliente adicionado com sucesso!');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const deleteClient = async (id: number) => {
    await apiFetch(`/clients/${id}`, { method: 'DELETE' });
    if (selectedClient?.id === id) {
      setSelectedClient(null);
    }
    setClientToDelete(null);
    fetchClients();
    showToast('Cliente excluído com sucesso.');
  };

  const fetchKeywords = async (clientId: number) => {
    const res = await apiFetch(`/clients/${clientId}/keywords`);
    setKeywords(await res.json());
  };

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !selectedClient) return;

    const keywordsArray = newKeyword.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);

    try {
      const res = await apiFetch(`/clients/${selectedClient.id}/keywords/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsArray })
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Erro ao salvar palavras-chave'));
      }

      setNewKeyword('');
      fetchKeywords(selectedClient.id);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const deleteKeyword = async (id: number) => {
    await apiFetch(`/keywords/${id}`, { method: 'DELETE' });
    if (selectedClient) {
      fetchKeywords(selectedClient.id);
    }
  };

  const deleteAllKeywords = async () => {
    if (!selectedClient || keywords.length === 0) return;
    if (!confirm('Tem certeza que deseja apagar todas as palavras-chave deste cliente?')) return;

    await apiFetch(`/clients/${selectedClient.id}/keywords`, { method: 'DELETE' });
    fetchKeywords(selectedClient.id);
    showToast('Todas as palavras-chave foram apagadas.');
  };

  const fetchRegions = async (clientId: number) => {
    const res = await apiFetch(`/clients/${clientId}/regions`);
    setRegions(await res.json());
  };

  const addRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegion.trim() || !selectedClient) return;

    const regionsArray = newRegion.split(/[\n,]+/).map(r => r.trim()).filter(Boolean);

    try {
      const res = await apiFetch(`/clients/${selectedClient.id}/regions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions: regionsArray })
      });

      if (!res.ok) {
        throw new Error('Erro ao salvar regiões');
      }

      setNewRegion('');
      fetchRegions(selectedClient.id);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const deleteRegion = async (id: number) => {
    await apiFetch(`/regions/${id}`, { method: 'DELETE' });
    if (selectedClient) {
      fetchRegions(selectedClient.id);
    }
  };

  const deleteAllRegions = async () => {
    if (!selectedClient || regions.length === 0) return;
    if (!confirm('Tem certeza que deseja apagar todas as regiões deste cliente?')) return;

    await apiFetch(`/clients/${selectedClient.id}/regions`, { method: 'DELETE' });
    fetchRegions(selectedClient.id);
    showToast('Todas as regiões foram apagadas.');
  };

  const fetchTemplate = async (clientId: number) => {
    const requestId = ++templateRequestRef.current;
    const res = await apiFetch(`/clients/${clientId}/template`);
    const data = await res.json();

    if (templateRequestRef.current !== requestId || selectedClient?.id !== clientId) {
      return;
    }

    setTemplate(data.content || DEFAULT_TEMPLATE);
  };

  const fetchGenerationJob = async (clientId: number) => {
    try {
      const res = await apiFetch(`/clients/${clientId}/generation-job`);
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Erro ao buscar o job de geração'));
      }

      const data = await res.json();
      if (!data?.id) {
        setJobStatus(null);
        return;
      }

      setJobStatus(normalizeJobStatus(data));
    } catch (error) {
      console.error('Erro ao buscar job:', error);
    }
  };

  const updateJobStatus = (job: any) => {
    const normalized = normalizeJobStatus(job);
    setJobStatus(normalized);
    return normalized;
  };

  const saveWhatsappConfig = async () => {
    if (!selectedClient) return;

    await apiFetch(`/clients/${selectedClient.id}/whatsapp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp_number: whatsappNumber, whatsapp_message: whatsappMessage })
    });

    const updatedClient = { ...selectedClient, whatsapp_number: whatsappNumber, whatsapp_message: whatsappMessage };
    setSelectedClient(updatedClient);
    setClients(clients.map(c => c.id === selectedClient.id ? updatedClient : c));
    showToast('Configuração do WhatsApp salva com sucesso!');
  };

  const saveTemplate = async () => {
    if (!selectedClient) return;

    try {
      const res = await apiFetch(`/clients/${selectedClient.id}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: template })
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Erro ao salvar template do cliente'));
      }

      showToast('Template salvo para este cliente com sucesso!');
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar template do cliente', 'error');
    }
  };

  const saveGlobalTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || !template.trim()) return;

    try {
      const res = await apiFetch('/global-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName, content: template })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar template');
      }

      setNewTemplateName('');
      setShowSaveTemplateModal(false);
      fetchGlobalTemplates();
      showToast('Template salvo na biblioteca com sucesso!');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const deleteGlobalTemplate = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este template da biblioteca?')) return;
    await apiFetch(`/global-templates/${id}`, { method: 'DELETE' });
    fetchGlobalTemplates();
    showToast('Template removido da biblioteca.');
  };

  const loadGlobalTemplate = (content: string) => {
    setTemplate(content);
    showToast('Template carregado com sucesso!');
  };

  const buildPrompt = (clientName: string, clientContext: string, keyword: string, region: string) => {
    const regionText = region ? ` em ${region}` : '';
    const regionPromptText = region ? ` na região de '${region}'` : '';

    return `Você é um Especialista Sênior em SEO e Copywriting. Sua tarefa é escrever um texto completo, longo e altamente otimizado para SEO sobre '${keyword}'${regionPromptText}.
O cliente é '${clientName}'. Informações adicionais sobre o cliente/serviço: '${clientContext}'.

DIRETRIZES DE SEO E SEMÂNTICA (MUITO IMPORTANTE):
1. Estrutura Completa: O texto deve ser aprofundado, persuasivo e cobrir o assunto de ponta a ponta para garantir a melhor performance de ranqueamento no Google.
2. Hierarquia de Títulos: NÃO utilize a tag <h1> (ela já será incluída manualmente no template). Comece a sua hierarquia de títulos obrigatoriamente a partir do <h2> para os tópicos principais, e <h3> para subtópicos.
3. Elementos HTML: Utilize parágrafos (<p>), listas (<ul>/<li>), negrito (<strong>) para termos importantes, e inclua pelo menos um link (<a>) contextualizado (pode usar '#' como href se não houver URL específica, ex: <a href="#">fale conosco</a>).
4. Palavra-chave: Inclua a exata frase '${keyword}${regionText}' (ou variações naturais) de forma estratégica e natural ao longo do texto (pelo menos 3 a 5 vezes, distribuídas entre os H2/H3 e o corpo do texto).

Retorne o resultado EXCLUSIVAMENTE em formato JSON com a seguinte estrutura:
{
  "metaDescription": "Uma meta description persuasiva e otimizada para SEO, contendo a palavra-chave${region ? ' e a região' : ''}, com no máximo 160 caracteres.",
  "seoText": "O código HTML puro do texto completo, sem as tags <html>, <head> ou <body>."
}`;
  };

  const buildFileContent = (
    config: JobConfig,
    keyword: string,
    region: string,
    seoText: string,
    metaDescription: string,
  ) => {
    const regionText = region ? ` em ${region}` : '';
    const title = `${keyword}${regionText}`;
    const cleanNumber = config.whatsapp_number.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(
      config.whatsapp_message
        .replace(/\{\{KEYWORD\}\}/g, keyword)
        .replace(/\{\{REGION\}\}/g, region),
    );
    const whatsappLink = cleanNumber ? `https://wa.me/${cleanNumber}${encodedMessage ? `?text=${encodedMessage}` : ''}` : '#';

    let fileContent = config.template;
    fileContent = fileContent.replace(/\{\{SEO_TEXT\}\}/g, seoText);
    fileContent = fileContent.replace(/\{\{TITLE\}\}/g, title);
    fileContent = fileContent.replace(/\{\{DESCRIPTION\}\}/g, metaDescription);
    fileContent = fileContent.replace(/\{\{KEYWORD\}\}/g, keyword);
    fileContent = fileContent.replace(/\{\{REGION\}\}/g, region);
    fileContent = fileContent.replace(/\{\{COMPANY_NAME\}\}/g, config.client_name);
    fileContent = fileContent.replace(/\{\{WHATSAPP_LINK\}\}/g, whatsappLink);

    return fileContent;
  };

  const downloadCurrentZip = async (currentJob?: JobStatus | null) => {
    const job = currentJob || jobStatus;

    if (!job?.downloadUrl) {
      showToast('Nenhum ZIP disponível para download ainda.', 'error');
      return;
    }

    const relativeUrl = job.downloadUrl.startsWith('/api')
      ? job.downloadUrl.replace(/^\/api/, '')
      : job.downloadUrl;

    try {
      const res = await apiFetch(relativeUrl);
      if (!res.ok) {
        throw new Error(await parseApiError(res, 'Erro ao baixar o ZIP'));
      }

      const blob = await res.blob();
      saveAs(blob, job.zipFilename || 'textos-seo.zip');
    } catch (error: any) {
      showToast(error.message || 'Erro ao baixar ZIP.', 'error');
    }
  };

  const requestPause = () => {
    if (!isGenerating || !jobStatus?.id) return;

    pauseRequestedRef.current = true;
    setJobStatus(current => current ? {
      ...current,
      message: 'Pausando após concluir o item atual...'
    } : current);
  };

  const processGeneration = async (initialJob: JobStatus) => {
    const apiKey =
      (import.meta as any).env?.VITE_GEMINI_API_KEY ||
      (typeof process !== 'undefined' ? (process as any).env?.GEMINI_API_KEY : '');

    if (!apiKey) {
      throw new Error('A chave do Gemini não está configurada.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const completedIndexes = new Set(initialJob.completedIndexes);

    for (const item of initialJob.items) {
      if (completedIndexes.has(item.index)) {
        continue;
      }

      setJobStatus(current => current ? {
        ...current,
        status: 'running',
        message: `Gerando: ${item.keyword}${item.region ? ` em ${item.region}` : ''}...`
      } : current);

      const prompt = buildPrompt(initialJob.config.client_name, initialJob.config.client_context, item.keyword, item.region);
      let response: any;
      let retries = 5;
      let delay = 5000;

      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  metaDescription: {
                    type: Type.STRING,
                    description: 'Uma meta description persuasiva e otimizada para SEO, contendo a palavra-chave, com no máximo 160 caracteres.'
                  },
                  seoText: {
                    type: Type.STRING,
                    description: 'O código HTML puro do texto completo, sem as tags <html>, <head> ou <body>.'
                  }
                },
                required: ['metaDescription', 'seoText']
              }
            }
          });
          break;
        } catch (err: any) {
          const errorMessage = getErrorMessage(err);

          if (isRetryableGenerationError(errorMessage)) {
            retries -= 1;

            if (retries === 0) {
              throw new Error(`A API do Gemini está temporariamente indisponível ou sobrecarregada. Tente novamente em alguns minutos. Detalhe: ${errorMessage}`);
            }

            setJobStatus(current => current ? {
              ...current,
              message: `Gemini indisponível no momento. Nova tentativa em ${Math.ceil(delay / 1000)}s (${retries} restantes)...`
            } : current);

            await sleep(delay);
            delay *= 2;
          } else {
            throw err;
          }
        }
      }

      await sleep(3000);

      let seoText = '';
      let metaDescription = '';
      const rawText = response?.text || '';

      try {
        const parsed = JSON.parse(rawText);
        seoText = parsed.seoText || '';
        metaDescription = parsed.metaDescription || '';
      } catch {
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            seoText = parsed.seoText || '';
            metaDescription = parsed.metaDescription || '';
          } else {
            seoText = rawText;
          }
        } catch {
          seoText = rawText;
        }
      }

      seoText = seoText.replace(/^```html\n?/m, '').replace(/^```\n?/m, '').replace(/```$/m, '').trim();

      const fileContent = buildFileContent(
        initialJob.config,
        item.keyword,
        item.region,
        seoText,
        metaDescription,
      );

      const saveRes = await apiFetch(`/jobs/${initialJob.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: item.index,
          filename: item.filename,
          content: fileContent,
        })
      });

      if (!saveRes.ok) {
        throw new Error(await parseApiError(saveRes, 'Erro ao salvar o arquivo gerado'));
      }

      const savedJob = updateJobStatus(await saveRes.json());
      completedIndexes.add(item.index);
      const shouldAutoPause =
        savedJob.progress > 0 &&
        savedJob.progress < savedJob.total &&
        savedJob.progress % AUTO_PAUSE_BATCH_SIZE === 0;

      if (pauseRequestedRef.current || shouldAutoPause) {
        const pauseRes = await apiFetch(`/jobs/${initialJob.id}/pause`, { method: 'POST' });
        if (!pauseRes.ok) {
          throw new Error(await parseApiError(pauseRes, 'Erro ao pausar a geração'));
        }

        const pausedJob = updateJobStatus(await pauseRes.json());
        pauseRequestedRef.current = false;
        setIsGenerating(false);
        if (shouldAutoPause) {
          setJobStatus(current => current ? {
            ...current,
            message: `Pausa automática ao atingir ${pausedJob.progress} arquivos.`
          } : current);
          showToast(`Pausa automática aplicada ao atingir ${pausedJob.progress} arquivos.`);
        } else {
          await downloadCurrentZip(pausedJob);
        }
        showToast(`Geração pausada com ${pausedJob.progress} arquivo(s) já no ZIP.`);
        return;
      }

      if (savedJob.progress >= savedJob.total) {
        const completeRes = await apiFetch(`/jobs/${initialJob.id}/complete`, { method: 'POST' });
        if (!completeRes.ok) {
          throw new Error(await parseApiError(completeRes, 'Erro ao finalizar a geração'));
        }

        updateJobStatus(await completeRes.json());
        setIsGenerating(false);
        showToast('Geração concluída com sucesso!');
        return;
      }
    }

    setIsGenerating(false);
  };

  const generateTexts = async () => {
    if (!selectedClient) return;

    if (keywords.length === 0) {
      showToast('Por favor, adicione pelo menos uma palavra-chave antes de gerar.', 'error');
      return;
    }

    if (!template.trim()) {
      showToast('O template não pode estar vazio.', 'error');
      return;
    }

    let currentJob: JobStatus | null = null;

    try {
      pauseRequestedRef.current = false;

      const saveTemplateResponse = await apiFetch(`/clients/${selectedClient.id}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: template })
      });

      if (!saveTemplateResponse.ok) {
        throw new Error(await parseApiError(saveTemplateResponse, 'Erro ao salvar template antes da geração'));
      }

      const response = await apiFetch(`/clients/${selectedClient.id}/generation-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          client_name: selectedClient.name || selectedClient.nome || '',
          client_context: selectedClient.context || selectedClient.descricao || '',
          whatsapp_number: whatsappNumber,
          whatsapp_message: whatsappMessage,
          items: buildGenerationItems(keywords, regions),
        })
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Erro ao iniciar a geração'));
      }

      currentJob = updateJobStatus(await response.json());
      setIsGenerating(true);
      await processGeneration(currentJob);
    } catch (error: any) {
      console.error('Generation error:', error);

      if (currentJob?.id) {
        await apiFetch(`/jobs/${currentJob.id}/error`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: error.message || 'Erro desconhecido' })
        }).catch(() => null);
      }

      setJobStatus(current => current ? {
        ...current,
        status: 'error',
        message: error.message || 'Erro desconhecido'
      } : current);
      setIsGenerating(false);
      showToast(error.message || 'Erro desconhecido', 'error');
    }
  };

  const canResume = !!jobStatus && jobStatus.progress > 0 && jobStatus.progress < jobStatus.total && !isGenerating;
  const canDownloadPartial = !!jobStatus && jobStatus.progress > 0;
  const generationCount = keywords.length * (regions.length > 0 ? regions.length : 1);
  const progressPercent = jobStatus?.total ? (jobStatus.progress / jobStatus.total) * 100 : 0;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans relative">
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Salvar Template na Biblioteca</h3>
            <form onSubmit={saveGlobalTemplate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Template</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Template Landing Page Padrão"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 border border-gray-300 font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
          {toast.message}
        </div>
      )}

      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
            <FileText className="w-6 h-6" />
            SEO Generator
          </h1>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Novo Cliente</h2>
          <form onSubmit={addClient} className="space-y-3">
            <input
              type="text"
              placeholder="Nome do Cliente"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
            />
            <textarea
              placeholder="Contexto (O que a empresa faz, diferenciais...)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              rows={2}
              value={newClientContext}
              onChange={(e) => setNewClientContext(e.target.value)}
            />
            <button type="submit" className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Clientes</h2>
          <ul className="space-y-2">
            {clients.map(client => (
              <li key={client.id} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedClient?.id === client.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-100 border border-transparent'}`} onClick={() => setSelectedClient(client)}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <Users className={`w-5 h-5 flex-shrink-0 ${selectedClient?.id === client.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className="truncate font-medium">{client.name || client.nome || 'Sem Nome'}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (clientToDelete === client.id) {
                      deleteClient(client.id);
                    } else {
                      setClientToDelete(client.id);
                      setTimeout(() => setClientToDelete(null), 3000);
                    }
                  }}
                  className={`p-1 transition-colors ${clientToDelete === client.id ? 'text-red-600 font-bold text-xs bg-red-50 rounded px-2' : 'text-gray-400 hover:text-red-500'}`}
                >
                  {clientToDelete === client.id ? 'Excluir?' : <Trash2 className="w-4 h-4" />}
                </button>
              </li>
            ))}
            {clients.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum cliente cadastrado.</p>
            )}
          </ul>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedClient ? (
          <>
            <div className="p-6 border-b border-gray-200 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">{selectedClient.name || selectedClient.nome}</h2>
              <div className="mt-1">
                <p className={`text-gray-500 ${isContextExpanded ? '' : 'truncate'}`}>
                  {selectedClient.context || selectedClient.descricao || 'Sem contexto adicional.'}
                </p>
                {(selectedClient.context || selectedClient.descricao) && (
                  <button
                    type="button"
                    onClick={() => setIsContextExpanded(current => !current)}
                    className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {isContextExpanded ? 'Recolher' : 'Expandir'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Key className="w-5 h-5 text-indigo-500" />
                      Palavras-chave ({keywords.length})
                    </h3>
                    <button
                      type="button"
                      onClick={deleteAllKeywords}
                      disabled={keywords.length === 0}
                      className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apagar Todas
                    </button>
                  </div>
                  <form onSubmit={addKeyword} className="flex flex-col gap-2 mb-4">
                    <textarea
                      placeholder="Ex: dentista invisalign (adicione várias separando por vírgula ou uma por linha)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      rows={3}
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                    />
                    <button type="submit" className="self-end px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300 text-sm font-medium">
                      Adicionar
                    </button>
                  </form>
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {keywords.map(kw => (
                      <li key={kw.id} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                        <span className="text-sm">{kw.keyword}</span>
                        <button onClick={() => deleteKeyword(kw.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-indigo-500" />
                      Regiões ({regions.length})
                    </h3>
                    <button
                      type="button"
                      onClick={deleteAllRegions}
                      disabled={regions.length === 0}
                      className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apagar Todas
                    </button>
                  </div>
                  <form onSubmit={addRegion} className="flex flex-col gap-2 mb-4">
                    <textarea
                      placeholder="Ex: São Paulo, SP (adicione várias separando por vírgula ou uma por linha)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      rows={3}
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                    />
                    <button type="submit" className="self-end px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300 text-sm font-medium">
                      Adicionar
                    </button>
                  </form>
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {regions.map(reg => (
                      <li key={reg.id} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                        <span className="text-sm">{reg.region}</span>
                        <button onClick={() => deleteRegion(reg.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  Configuração do WhatsApp
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp</label>
                    <input
                      type="text"
                      placeholder="Ex: 5511999999999"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Apenas números, inclua o código do país (ex: 55 para Brasil).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem Padrão</label>
                    <input
                      type="text"
                      placeholder="Ex: Olá, tenho interesse em {{KEYWORD}} em {{REGION}}"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Você pode usar as tags {'{{KEYWORD}}'} e {'{{REGION}}'} aqui.</p>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={saveWhatsappConfig} className="px-4 py-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 font-medium text-sm border border-green-200 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Salvar Configuração
                  </button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    Template Base (modelo.php)
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {globalTemplates.length > 0 && (
                      <div className="relative group">
                        <button className="px-3 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm border border-gray-300 flex items-center gap-2">
                          <FolderOpen className="w-4 h-4" />
                          Carregar Template
                        </button>
                        <div className="absolute right-0 top-full pt-1 w-64 hidden group-hover:block z-10">
                          <div className="bg-white border border-gray-200 rounded-md shadow-lg">
                            <ul className="py-1 max-h-60 overflow-auto">
                              {globalTemplates.map(gt => (
                                <li key={gt.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                                  <button className="text-sm text-left flex-1 truncate text-gray-700" onClick={() => loadGlobalTemplate(gt.content)}>
                                    {gt.name}
                                  </button>
                                  <button onClick={() => deleteGlobalTemplate(gt.id)} className="text-gray-400 hover:text-red-500 ml-2" title="Excluir template">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setShowSaveTemplateModal(true)} className="px-3 py-2 bg-white text-indigo-600 rounded-md hover:bg-indigo-50 font-medium text-sm border border-indigo-200 flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Salvar na Biblioteca
                    </button>
                    <button onClick={saveTemplate} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm border border-transparent">
                      Salvar para Cliente
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Use as tags <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{SEO_TEXT}}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{TITLE}}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{DESCRIPTION}}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{KEYWORD}}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{REGION}}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{COMPANY_NAME}}'}</code> e <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{'{{WHATSAPP_LINK}}'}</code>.
                </p>
                <textarea
                  className="w-full h-64 font-mono text-sm p-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <title>{{TITLE}}</title>\n  <meta name="description" content="{{DESCRIPTION}}">\n</head>\n<body>\n  <main>\n    <h1>{{TITLE}}</h1>\n    <p>{{COMPANY_NAME}}</p>\n    {{SEO_TEXT}}\n    <a href="{{WHATSAPP_LINK}}" target="_blank">Fale conosco pelo WhatsApp</a>\n  </main>\n</body>\n</html>`}
                />
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <h3 className="text-xl font-bold mb-2">Gerar Textos SEO</h3>
                <p className="text-gray-500 mb-6 max-w-lg">
                  Serão gerados <strong>{generationCount}</strong> arquivos PHP {regions.length > 0 ? 'combinando cada palavra-chave com cada região' : 'para cada palavra-chave'} usando a API do Gemini.
                </p>

                {!isGenerating && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={generateTexts}
                      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
                    >
                      <Play className="w-5 h-5" />
                      {canResume ? 'Retomar Geração' : 'Iniciar Geração'}
                    </button>

                    {canDownloadPartial && (
                      <button
                        onClick={() => downloadCurrentZip()}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-full font-medium hover:bg-gray-50 border border-gray-300 shadow-sm transition-all"
                      >
                        <Download className="w-5 h-5" />
                        Baixar ZIP Atual
                      </button>
                    )}
                  </div>
                )}
                {jobStatus && (
                  <div className="mt-6 w-full max-w-lg">
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className={`flex items-center gap-2 ${jobStatus.status === 'error' ? 'text-red-600' : 'text-indigo-600'}`}>
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        {jobStatus.message || 'Job pronto para continuar.'}
                      </span>
                      <span className="text-gray-500">{jobStatus.progress} / {jobStatus.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-2.5 rounded-full transition-all duration-500 ${jobStatus.status === 'error' ? 'bg-red-500' : jobStatus.status === 'completed' ? 'bg-green-600' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
                    </div>

                    {isGenerating && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={requestPause}
                          className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-full font-medium hover:bg-amber-600 shadow-md transition-all"
                        >
                          <Pause className="w-5 h-5" />
                          Pausar e Baixar ZIP
                        </button>
                      </div>
                    )}

                    {!isGenerating && jobStatus.status === 'paused' && (
                      <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        A geração foi pausada. Ao iniciar novamente, ela continua exatamente de onde parou.
                      </p>
                    )}

                    {!isGenerating && jobStatus.status === 'completed' && (
                      <div className="mt-4 flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                          <Download className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">Geração Concluída!</h4>
                        <p className="text-gray-500 mb-4">Todos os {jobStatus.total} arquivos foram gerados com sucesso.</p>
                        <button
                          onClick={() => downloadCurrentZip()}
                          className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                        >
                          <Download className="w-5 h-5" />
                          Baixar ZIP
                        </button>
                      </div>
                    )}

                    {!isGenerating && jobStatus.status === 'error' && (
                      <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        <p className="font-medium">Erro na geração:</p>
                        <p className="text-sm">{jobStatus.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
            <FileText className="w-16 h-16 mb-4 opacity-20" />
            <h2 className="text-xl font-medium text-gray-500">Nenhum cliente selecionado</h2>
            <p className="mt-2 text-center max-w-md">
              Selecione um cliente na barra lateral ou cadastre um novo para gerenciar suas palavras-chave, regiões e gerar os textos de SEO.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
