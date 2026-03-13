import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Download, Play, FileText, MapPin, Key, Users, Settings, Loader2, MessageCircle, Save, FolderOpen } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Client {
  id: number;
  name: string;
  context: string;
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

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Client Form
  const [newClientName, setNewClientName] = useState('');
  const [newClientContext, setNewClientContext] = useState('');

  // Selected Client Data
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [template, setTemplate] = useState('');
  
  // Input fields
  const [newKeyword, setNewKeyword] = useState('');
  const [newRegion, setNewRegion] = useState('');

  // Job State
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<{status: string, progress: number, total: number, message: string, zipBlob?: Blob} | null>(null);

  // WhatsApp State
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  // UI State
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Global Templates State
  const [globalTemplates, setGlobalTemplates] = useState<GlobalTemplate[]>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

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
      fetchKeywords(selectedClient.id);
      fetchRegions(selectedClient.id);
      fetchTemplate(selectedClient.id);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    const data = await res.json();
    setClients(data);
  };

  const fetchGlobalTemplates = async () => {
    const res = await fetch('/api/global-templates');
    const data = await res.json();
    setGlobalTemplates(data);
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClientName, context: newClientContext })
    });
    if (res.ok) {
      setNewClientName('');
      setNewClientContext('');
      fetchClients();
    }
  };

  const deleteClient = async (id: number) => {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (selectedClient?.id === id) setSelectedClient(null);
    setClientToDelete(null);
    fetchClients();
    showToast('Cliente excluído com sucesso.');
  };

  const fetchKeywords = async (clientId: number) => {
    const res = await fetch(`/api/clients/${clientId}/keywords`);
    setKeywords(await res.json());
  };

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword || !selectedClient) return;
    await fetch(`/api/clients/${selectedClient.id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: newKeyword })
    });
    setNewKeyword('');
    fetchKeywords(selectedClient.id);
  };

  const deleteKeyword = async (id: number) => {
    await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
    if (selectedClient) fetchKeywords(selectedClient.id);
  };

  const fetchRegions = async (clientId: number) => {
    const res = await fetch(`/api/clients/${clientId}/regions`);
    setRegions(await res.json());
  };

  const addRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegion || !selectedClient) return;
    await fetch(`/api/clients/${selectedClient.id}/regions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: newRegion })
    });
    setNewRegion('');
    fetchRegions(selectedClient.id);
  };

  const deleteRegion = async (id: number) => {
    await fetch(`/api/regions/${id}`, { method: 'DELETE' });
    if (selectedClient) fetchRegions(selectedClient.id);
  };

  const fetchTemplate = async (clientId: number) => {
    const res = await fetch(`/api/clients/${clientId}/template`);
    const data = await res.json();
    setTemplate(data.content || `<!DOCTYPE html>
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
</html>`);
  };

  const saveTemplate = async () => {
    if (!selectedClient) return;
    await fetch(`/api/clients/${selectedClient.id}/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: template })
    });
    showToast('Template salvo para este cliente com sucesso!');
  };

  const saveGlobalTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || !template.trim()) return;
    const res = await fetch('/api/global-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTemplateName, content: template })
    });
    if (res.ok) {
      setNewTemplateName('');
      setShowSaveTemplateModal(false);
      fetchGlobalTemplates();
      showToast('Template salvo na biblioteca com sucesso!');
    }
  };

  const deleteGlobalTemplate = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este template da biblioteca?')) return;
    await fetch(`/api/global-templates/${id}`, { method: 'DELETE' });
    fetchGlobalTemplates();
    showToast('Template removido da biblioteca.');
  };

  const loadGlobalTemplate = (content: string) => {
    setTemplate(content);
    showToast('Template carregado com sucesso!');
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
    
    // Auto-save template before generating
    await fetch(`/api/clients/${selectedClient.id}/template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: template })
    });

    setJobStatus(null);
    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const regionsToProcess = regions.length > 0 ? regions : [{ id: 0, region: '' }];
      const total = keywords.length * regionsToProcess.length;
      let completed = 0;
      
      setJobStatus({ status: 'running', progress: 0, total, message: 'Iniciando...' });
      
      const zip = new JSZip();

      for (const kw of keywords) {
        for (const reg of regionsToProcess) {
          const keyword = kw.keyword;
          const region = reg.region;
          
          const regionText = region ? ` em ${region}` : '';
          const regionPromptText = region ? ` na região de '${region}'` : '';
          
          setJobStatus({ status: 'running', progress: completed, total, message: `Gerando: ${keyword}${regionText}...` });

          const prompt = `Você é um Especialista Sênior em SEO e Copywriting. Sua tarefa é escrever um texto completo, longo e altamente otimizado para SEO sobre '${keyword}'${regionPromptText}.
O cliente é '${selectedClient.name}'. Informações adicionais sobre o cliente/serviço: '${selectedClient.context}'.

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

          let response;
          let retries = 3;
          let delay = 5000;

          while (retries > 0) {
            try {
              response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                }
              });
              break; // Success, exit retry loop
            } catch (err: any) {
              const isRateLimit = err.message && err.message.includes('429');
              const isUnavailable = err.message && (err.message.includes('503') || err.message.includes('UNAVAILABLE'));
              const isLimited = isRateLimit || isUnavailable;

              if (isLimited) {
                retries--;
                if (retries === 0) throw err;
                setJobStatus({ status: 'running', progress: completed, total, message: `Serviço ocupado. Tentando de novo em ${delay / 1000}s... (${retries} tentativas restantes)` });
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
              } else {
                throw err; // Re-throw if it's not a rate limit / service unavailable error
              }
            }
          }

          // Add a small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 3000));

          let seoText = '';
          let metaDescription = '';
          try {
            const jsonResponse = JSON.parse(response.text || '{}');
            seoText = jsonResponse.seoText || '';
            metaDescription = jsonResponse.metaDescription || '';
          } catch (e) {
            console.error('Failed to parse JSON response', e);
            seoText = response.text || '';
          }

          // Clean up potential markdown blocks just in case
          seoText = seoText.replace(/^```html\n?/m, '').replace(/^```\n?/m, '').replace(/```$/m, '').trim();

          const title = `${keyword}${regionText} - ${selectedClient.name}`;
          
          // Generate WhatsApp Link
          const cleanNumber = whatsappNumber.replace(/\D/g, '');
          const encodedMessage = encodeURIComponent(whatsappMessage.replace(/\{\{KEYWORD\}\}/g, keyword).replace(/\{\{REGION\}\}/g, region));
          const whatsappLink = cleanNumber ? `https://wa.me/${cleanNumber}${encodedMessage ? `?text=${encodedMessage}` : ''}` : '#';

          let fileContent = template;
          fileContent = fileContent.replace(/\{\{SEO_TEXT\}\}/g, seoText);
          fileContent = fileContent.replace(/\{\{TITLE\}\}/g, title);
          fileContent = fileContent.replace(/\{\{DESCRIPTION\}\}/g, metaDescription);
          fileContent = fileContent.replace(/\{\{KEYWORD\}\}/g, keyword);
          fileContent = fileContent.replace(/\{\{REGION\}\}/g, region);
          fileContent = fileContent.replace(/\{\{WHATSAPP_LINK\}\}/g, whatsappLink);

          // Create filename: keyword-region.php or keyword.php
          const safeKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const safeRegion = region ? region.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '';
          const filename = safeRegion ? `${safeKeyword}-${safeRegion}.php` : `${safeKeyword}.php`;

          zip.file(filename, fileContent);
          
          completed++;
        }
      }

      setJobStatus({ status: 'running', progress: completed, total, message: 'Finalizando arquivo ZIP...' });
      
      const content = await zip.generateAsync({ type: 'blob' });
      
      setJobStatus({ status: 'completed', progress: completed, total, message: 'Concluído!', zipBlob: content });
      setIsGenerating(false);

    } catch (error: any) {
      console.error('Generation error:', error);
      setJobStatus({ status: 'error', progress: 0, total: 0, message: error.message || 'Erro desconhecido' });
      setIsGenerating(false);
    }
  };

  const downloadZip = () => {
    if (jobStatus?.zipBlob) {
      saveAs(jobStatus.zipBlob, 'textos-seo.zip');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans relative">
      {/* Save Template Modal */}
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

      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Sidebar */}
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
                  <span className="truncate font-medium">{client.name}</span>
                </div>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (clientToDelete === client.id) {
                      deleteClient(client.id);
                    } else {
                      setClientToDelete(client.id);
                      // Auto-cancel after 3 seconds
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedClient ? (
          <>
            <div className="p-6 border-b border-gray-200 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">{selectedClient.name}</h2>
              <p className="text-gray-500 mt-1">{selectedClient.context || 'Sem contexto adicional.'}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Keywords */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                    <Key className="w-5 h-5 text-indigo-500" />
                    Palavras-chave ({keywords.length})
                  </h3>
                  <form onSubmit={addKeyword} className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Ex: dentista invisalign"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                    />
                    <button type="submit" className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300">
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

                {/* Regions */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                    Regiões ({regions.length})
                  </h3>
                  <form onSubmit={addRegion} className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Ex: São Paulo, SP"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                    />
                    <button type="submit" className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300">
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

              {/* WhatsApp Config */}
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
              </div>

              {/* Template */}
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
                        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block z-10">
                          <ul className="py-1 max-h-60 overflow-auto">
                            {globalTemplates.map(gt => (
                              <li key={gt.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                                <button 
                                  className="text-sm text-left flex-1 truncate text-gray-700"
                                  onClick={() => loadGlobalTemplate(gt.content)}
                                >
                                  {gt.name}
                                </button>
                                <button 
                                  onClick={() => deleteGlobalTemplate(gt.id)}
                                  className="text-gray-400 hover:text-red-500 ml-2"
                                  title="Excluir template"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
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
                  Use as tags <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{"{{SEO_TEXT}}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{"{{TITLE}}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{"{{DESCRIPTION}}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{"{{KEYWORD}}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{"{{REGION}}"}</code> e <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">{"{{WHATSAPP_LINK}}"}</code>.
                </p>
                <textarea
                  className="w-full h-64 font-mono text-sm p-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <title>{{TITLE}}</title>\n  <meta name="description" content="{{DESCRIPTION}}">\n</head>\n<body>\n  <main>\n    <h1>{{TITLE}}</h1>\n    {{SEO_TEXT}}\n    <a href="{{WHATSAPP_LINK}}" target="_blank">Fale conosco pelo WhatsApp</a>\n  </main>\n</body>\n</html>`}
                />
              </div>

              {/* Generator Action */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <h3 className="text-xl font-bold mb-2">Gerar Textos SEO</h3>
                <p className="text-gray-500 mb-6 max-w-lg">
                  Serão gerados <strong>{keywords.length * (regions.length > 0 ? regions.length : 1)}</strong> arquivos PHP {regions.length > 0 ? 'combinando cada palavra-chave com cada região' : 'para cada palavra-chave'} usando a API do Gemini.
                </p>
                
                {(!jobStatus || jobStatus.status === 'error') && !isGenerating && (
                  <button 
                    onClick={generateTexts}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all"
                  >
                    <Play className="w-5 h-5" />
                    Iniciar Geração
                  </button>
                )}

                {jobStatus && jobStatus.status === 'error' && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 w-full max-w-lg">
                    <p className="font-medium">Erro na geração:</p>
                    <p className="text-sm">{jobStatus.message}</p>
                  </div>
                )}

                {jobStatus && jobStatus.status === 'running' && (
                  <div className="mt-6 w-full max-w-lg">
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="text-indigo-600 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {jobStatus.message}
                      </span>
                      <span className="text-gray-500">{jobStatus.progress} / {jobStatus.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(jobStatus.progress / jobStatus.total) * 100}%` }}></div>
                    </div>
                  </div>
                )}

                {jobStatus && jobStatus.status === 'completed' && (
                  <div className="mt-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                      <Download className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Geração Concluída!</h4>
                    <p className="text-gray-500 mb-6">Todos os {jobStatus.total} arquivos foram gerados com sucesso.</p>
                    <button 
                      onClick={downloadZip}
                      className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                    >
                      <Download className="w-5 h-5" />
                      Baixar ZIP
                    </button>
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

