import React, { useState } from 'react';
import { FileText, Link, UploadCloud, Play, Image as ImageIcon, CheckCircle, X } from 'lucide-react';
import { useToast } from './Toast';

const ScannerInput = ({ onScan }) => {
  const [activeTab, setActiveTab] = useState('text');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const { addToast } = useToast();

  const handleScan = async () => {
    if (activeTab === 'image') {
      if (!imageFile) return;
      setIsScanning(true);
      await onScan(imageFile, 'image');
      setIsScanning(false);
    } else {
      if (!content.trim()) return;
      setIsScanning(true);
      await onScan(content, activeTab);
      setIsScanning(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target.result);
      // Change to text tab to show the file contents
      setActiveTab('text');
    };
    reader.readAsText(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast("Veuillez sélectionner un fichier image valide (PNG, JPG, etc.)", 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result.split(',')[1];
      setImageFile({
        base64: base64String,
        mimeType: file.type
      });
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const isBtnDisabled = isScanning || (activeTab === 'image' ? !imageFile : !content.trim());

  return (
    <div className="glass-panel p-6 flex flex-col gap-4 border border-neon-purple/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
      <div className="flex items-center gap-2 md:gap-4 border-b border-white/10 pb-4 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm shrink-0 ${
            activeTab === 'text' 
              ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText size={18} /> Texte / Lien iCal
        </button>
        <button 
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm shrink-0 ${
            activeTab === 'image' 
              ? 'bg-neon-teal/20 text-neon-teal border border-neon-teal/30' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ImageIcon size={18} /> Capture d'écran (Image)
        </button>
        <button 
          onClick={() => setActiveTab('url')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm shrink-0 ${
            activeTab === 'url' 
              ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Link size={18} /> Lien Web
        </button>
        <button 
          onClick={() => setActiveTab('file')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm shrink-0 ${
            activeTab === 'file' 
              ? 'bg-white/10 text-gray-200 border border-white/20' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <UploadCloud size={18} /> Fichier (.txt, .csv)
        </button>
      </div>

      <div className="flex-1">
        {activeTab === 'text' && (
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Collez ici le texte de votre emploi du temps, ou directement le lien iCal/Pronote (.ics)..."
            className="w-full h-40 bg-dark-900/50 border border-white/10 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-neon-purple/50 resize-none font-sans"
          ></textarea>
        )}
        
        {activeTab === 'image' && (
          <div className="w-full min-h-[160px] flex flex-col items-center justify-center">
            {imagePreview ? (
              <div className="relative group rounded-xl overflow-hidden border border-neon-teal/30 shadow-[0_0_15px_rgba(20,184,166,0.2)] max-w-md w-full">
                <img 
                  src={imagePreview} 
                  alt="Aperçu planning" 
                  className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent flex items-end p-4 justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-neon-teal" size={16} />
                    <span className="text-xs text-white font-bold">Image chargée</span>
                  </div>
                  <button 
                    onClick={clearImage}
                    className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-white transition-colors"
                    title="Supprimer l'image"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <label className="w-full h-40 border-2 border-dashed border-neon-teal/20 hover:border-neon-teal/50 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-neon-teal/5 transition-all cursor-pointer">
                <ImageIcon size={36} className="mb-2 text-neon-teal opacity-60 animate-pulse" />
                <span className="font-bold text-gray-300 text-sm">Déposez ou sélectionnez la capture d'écran</span>
                <span className="text-xs text-gray-500 mt-1">Format PNG, JPG, JPEG</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="hidden" 
                />
              </label>
            )}
          </div>
        )}

        {activeTab === 'url' && (
          <input 
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="https://example.com/planning"
            className="w-full bg-dark-900/50 border border-white/10 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-neon-blue/50"
          />
        )}

        {activeTab === 'file' && (
          <label className="w-full h-40 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-white/5 transition-colors cursor-pointer">
            <UploadCloud size={32} className="mb-2 opacity-50" />
            <span className="font-bold text-sm">Cliquez pour uploader un fichier texte</span>
            <span className="text-xs text-gray-500 mt-1">Formats supportés : .txt, .csv</span>
            <input 
              type="file" 
              accept=".txt,.csv" 
              onChange={handleFileUpload}
              className="hidden" 
            />
          </label>
        )}
      </div>

      <div className="flex justify-end border-t border-white/5 pt-4">
        <button 
          onClick={handleScan}
          disabled={isBtnDisabled}
          className={`flex items-center gap-2 font-bold px-6 py-3 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.3)] ${
            isBtnDisabled 
              ? 'bg-white/5 text-gray-500 cursor-not-allowed shadow-none' 
              : 'bg-neon-purple text-active-day-text hover:bg-neon-purple/80 hover:shadow-[0_0_25px_rgba(168,85,247,0.7)]'
          }`}
        >
          {isScanning ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-active-day-text border-t-transparent rounded-full animate-spin"></div>
              <span>Analyse en cours...</span>
            </div>
          ) : (
            <>
              <Play size={18} /> 
              <span>Lancer l'analyse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ScannerInput;
