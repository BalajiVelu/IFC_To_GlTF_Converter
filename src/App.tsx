import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { UploadCloud, Download, Loader2, AlertCircle, Layers, Monitor } from 'lucide-react';
import { processIfc, SpatialNode } from './lib/ifcProcessor';
import ThreeViewer from './components/ThreeViewer';
import HierarchyTree from './components/HierarchyTree';

export default function App() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [rootGroup, setRootGroup] = useState<THREE.Group | null>(null);
  const [spatialTree, setSpatialTree] = useState<SpatialNode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('processing');
    setErrorMsg('');
    setProgressMsg('Initializing...');
    setRootGroup(null);
    setSpatialTree(null);

    try {
      // Slight delay to allow UI to render "processing" before main thread blockage
      await new Promise(resolve => setTimeout(resolve, 50));
      const { rootGroup: newGroup, spatialTree: newTree } = await processIfc(file, (msg) => {
        setProgressMsg(msg);
      });
      
      setRootGroup(newGroup);
      setSpatialTree(newTree);
      setStatus('ready');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'An error occurred while processing the IFC file.');
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (!rootGroup) return;
    
    const exporter = new GLTFExporter();
    exporter.parse(
      rootGroup,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'model.glb';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      },
      (error) => {
        console.error('Failed to export GLTF:', error);
        alert('Failed to export GLTF');
      },
      { binary: true } // GLB format
    );
  };

  return (
    <div className="h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col overflow-hidden">
      {/* Header Navigation */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <span className="font-bold tracking-tight text-lg">IFC<span className="text-blue-600">STRUCT</span> <span className="font-medium text-slate-400 text-sm ml-2">Converter</span></span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <span className="text-blue-600 border-b-2 border-blue-600 pb-5 mt-5">Workspace</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-grow flex overflow-hidden">
        {/* Left Sidebar: Spatial Hierarchy */}
        <aside className="w-72 border-r border-slate-200 bg-white flex flex-col flex-shrink-0 z-10 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Spatial Hierarchy</h3>
          </div>
          
          <div className="flex-grow overflow-y-auto p-4 flex flex-col">
            {status === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center opacity-70">
                <span className="text-[10px] mt-2 font-mono uppercase tracking-widest">Waiting for input</span>
              </div>
            )}
            
            {status === 'processing' && (
              <div className="flex-1 flex flex-col items-center justify-center text-blue-600 text-center">
                <Loader2 className="w-6 h-6 mb-3 animate-spin mx-auto" />
                <p className="text-[10px] font-bold animate-pulse uppercase tracking-widest">{progressMsg}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center text-red-500 text-center px-4">
                <AlertCircle className="w-8 h-8 mb-3" />
                <p className="text-xs font-medium">{errorMsg}</p>
              </div>
            )}

            {status === 'ready' && spatialTree && (
              <div className="pt-1">
                <HierarchyTree node={spatialTree} />
              </div>
            )}
          </div>
          
          {spatialTree && (
            <div className="p-4 border-t border-slate-100 text-[10px] text-slate-400">
              Hierarchy Processed | Validated
            </div>
          )}
        </aside>

        {/* Center: 3D Viewport Area */}
        <section className="flex-grow bg-slate-100 relative flex flex-col">
          {/* Grid Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-0">
            <div className="grid grid-cols-12 gap-1 w-full h-full">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-slate-300"></div>
              ))}
            </div>
          </div>
          
          {/* Viewport UI */}
          <div className="absolute top-6 left-6 flex gap-2 z-10 pointer-events-none">
            <div className="bg-white/80 backdrop-blur px-3 py-1 text-[10px] font-bold border border-slate-200 shadow-sm text-slate-600">GLTF-PREVIEW</div>
            {status === 'ready' && (
              <div className="bg-blue-600 text-white px-3 py-1 text-[10px] font-bold shadow-sm">LOADED</div>
            )}
          </div>

          <div className="flex-grow relative z-10">
             <ThreeViewer rootGroup={rootGroup} />
             
             {status === 'idle' && (
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                 <div className="w-80 h-48 bg-slate-200/50 border-2 border-slate-400 border-dashed flex flex-col items-center justify-center text-slate-400">
                   <p className="text-xs font-mono text-slate-500 italic mt-4">Drop IFC model here</p>
                 </div>
               </div>
             )}
          </div>
          
          {/* Bottom Upload/Action Bar */}
          <div className="h-24 border-t border-slate-200 bg-white/90 backdrop-blur p-4 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center gap-6 h-full">
              <input
                type="file"
                accept=".ifc"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              
              <div 
                className={`border-2 ${status === 'ready' ? 'border-blue-200 bg-blue-50' : 'border-dashed border-slate-300 bg-slate-50'} px-6 py-2 rounded flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors h-full min-w-[280px]`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status === 'ready' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-xs font-bold text-slate-800">
                    {status === 'processing' ? 'Processing...' : status === 'ready' ? 'Model Loaded' : 'Select .IFC File'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-tighter mt-0.5">
                    {status === 'processing' ? 'Please wait' : status === 'ready' ? 'Ready for export' : 'Click to browse'}
                  </p>
                </div>
              </div>
              
              <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
              
              <div className="hidden sm:flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Output Engine</label>
                <select disabled className="text-xs font-medium text-slate-700 bg-transparent border-b border-slate-300 focus:outline-none pb-1 disabled:opacity-70">
                  <option>glTF Binary (.glb)</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handleDownload}
              disabled={status !== 'ready'}
              className="h-full bg-blue-600 disabled:bg-slate-300 text-white px-8 flex flex-col items-center justify-center gap-1 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:shadow-none min-w-[200px]"
            >
              <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Download className="w-4 h-4" />
                Convert & Download
              </span>
              {status === 'ready' && (
                <span className="text-[9px] opacity-80 mt-1">Preserving Hierarchy</span>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
