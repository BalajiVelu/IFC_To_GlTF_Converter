import React, { useState } from 'react';
import { SpatialNode } from '../lib/ifcProcessor';

interface HierarchyTreeProps {
  node: SpatialNode;
}

const HierarchyTree: React.FC<HierarchyTreeProps> = ({ node }) => {
  const [expanded, setExpanded] = useState(node.type === 'IfcProject' || node.type === 'IfcSite' || node.type === 'IfcBuilding');
  const hasChildren = node.children && node.children.length > 0;

  // Identify if root-ish node
  const isTopLevel = node.type === 'IfcProject';

  return (
    <div className="font-mono text-[11px] leading-relaxed select-none">
      <div 
        className={`flex items-center gap-2 py-[2px] cursor-pointer hover:bg-slate-50 transition-colors ${isTopLevel ? 'text-blue-600 font-bold mb-1' : 'text-slate-600 hover:text-slate-900 group'}`}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className={`w-3 h-3 flex-shrink-0 border flex items-center justify-center text-[8px] ${isTopLevel ? 'border-blue-600' : 'border-slate-300 group-hover:border-slate-400'}`}>
            {expanded ? '−' : '+'}
          </span>
        ) : (
          <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center text-slate-300">
            └
          </span>
        )}
        <span className="truncate" title={node.name}>
          {node.name}
        </span>
        <span className="ml-1 text-[9px] opacity-50 shrink-0">({node.type})</span>
      </div>

      {expanded && hasChildren && (
        <div className="ml-[5px] border-l border-slate-200 pl-3 py-1 flex flex-col gap-[2px]">
          {node.children.map((child) => (
            <HierarchyTree key={child.expressID} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default HierarchyTree;
