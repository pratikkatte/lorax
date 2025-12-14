import React from "react";

export default function InfoMutations({ treeDetails, setConfig }) {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
      <h2 className="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">Mutations</h2>
      {treeDetails?.mutations && treeDetails.mutations.length > 0 ? (
          <div className="space-y-1 max-h-96 overflow-y-auto">
              {treeDetails.mutations.map((mut) => (
                  <div 
                      key={mut.id} 
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => {
                          if (treeDetails.interval) {
                               setConfig(prev => ({
                                   ...prev,
                                   value: treeDetails.interval
                               }));
                          }
                      }}
                  >
                      <div className="flex justify-between">
                          <span className="font-medium text-sm">ID: {mut.id}</span>
                          <span className="text-sm text-gray-600">Pos: {Math.round(mut.position)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                          {mut.inherited_state} → {mut.derived_state}
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <div className="text-gray-500 text-sm py-2">No mutations in this tree</div>
      )}
    </div>
  );
}
