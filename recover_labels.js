const fs = require('fs');
const path = 'frontend/src/pages/Labels.tsx';
let content = fs.readFileSync(path, 'utf8');

const returnIdx = content.indexOf('return (');
// Find the SECOND to last return index to be sure we are at the main one? 
// No, line 1413 was the main one in the 2262 line version.
// Let's find "const canCarouselRight" and take the return after it.
const marker = 'const canCarouselRight  = carouselOffset + CAROUSEL_VISIBLE < selectedProducts.length;';
const markerIdx = content.indexOf(marker);
const finalReturnIdx = content.indexOf('return (', markerIdx);

if (finalReturnIdx === -1) {
    console.log('Main return not found');
    process.exit(1);
}

const before = content.substring(0, finalReturnIdx);

const newReturn = \`  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      <div className="px-3">
        <PageBanner
          title="Labels"
          subtitle={store?.ui_resolution === '1024x768' ? \`\\\${cols} labels/row\` : \`\\\${paper.label} · \\\${cols} labels/row · \\\${LABEL_W_MM}×\\\${LABEL_H_MM} mm\`}
          icon={<TagIcon className="w-5 h-5 text-white" />}
          action={
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-medium text-white/70 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                {selected.size} selected
              </span>
              <Button
                id="btn-preview-labels"
                disabled={selected.size === 0}
                onClick={() => setShowPreview(true)}
                size="sm"
                variant="primary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/20 shadow-none"
                leftIcon={<EyeIcon className="w-4 h-4" />}
              >
                Preview
              </Button>
            </div>
          }
        />
      </div>

      {/* ── Tabs ── */}
      <div className="px-3 mb-4">
        <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-soft flex items-center gap-1">
          <button
            onClick={() => setActiveTab('shelf')}
            className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all \\\${
              activeTab === 'shelf'
                ? 'bg-secondary-600 text-white shadow-brand'
                : 'text-gray-500 hover:bg-gray-50'
            }\`}
          >
            <TagIcon className="w-4 h-4" />
            Shelf Label
          </button>
          <button
            onClick={() => setActiveTab('promotion')}
            className={\`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all \\\${
              activeTab === 'promotion'
                ? 'bg-secondary-600 text-white shadow-brand'
                : 'text-gray-500 hover:bg-gray-50'
            }\`}
          >
            <PaintBrushIcon className="w-4 h-4" />
            Promotion Label
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'shelf' && canEditLayout && layoutForm && (
          <div className="px-3 pb-4 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-soft overflow-hidden">
              <button
                type="button"
                onClick={() => setEditorOpen(!editorOpen)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center">
                    <PaintBrushIcon className="w-4 h-4 text-secondary-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">Label Designer</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Customize layout, fonts & barcodes</p>
                  </div>
                </div>
                {editorOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
              </button>

              {editorOpen && (
                <div className="p-5 bg-white border-t border-gray-100">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                      <div className="space-y-6">
                        <LabelSectionFormFields
                          section={activeLabelSection}
                          layoutForm={layoutForm}
                          setField={setField}
                        />
                      </div>
                      <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100/50 space-y-4">
                        <ControlRow label="Stacking order">
                          <div className="space-y-1.5">
                            {layoutForm.label_section_order.map((id, i) => {
                              const meta = LABEL_SECTION_META.find(m => m.id === id);
                              return (
                                <div key={id} className="flex items-center gap-2 group">
                                  <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm flex items-center justify-between">
                                    <span>{meta?.label ?? id}</span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button type="button" onClick={() => moveSection(id, -1)} disabled={i === 0} className="p-1 hover:text-secondary-600 disabled:opacity-20"><ChevronUpIcon className="w-3 h-3" /></button>
                                      <button type="button" onClick={() => moveSection(id, 1)} disabled={i === 4} className="p-1 hover:text-secondary-600 disabled:opacity-20"><ChevronDownIcon className="w-3 h-3" /></button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ControlRow>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">Live Designer Preview</p>
                      <div className="relative group">
                        <div className="absolute inset-0 bg-secondary-500/5 blur-2xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative p-8 bg-white rounded-3xl border border-gray-200 shadow-2xl ring-1 ring-black/5"
                          style={{
                            backgroundImage: 'radial-gradient(circle, #334155 1.5px, transparent 1.5px)',
                            backgroundSize: '14px 14px',
                          }}
                        />
                        <div className="relative">
                          {previewStore && (
                            <LabelCard
                              storeName={previewStore.name ?? ''}
                              productName={editorProductName}
                              price={editorPrice}
                              currency={currency}
                              barcode={editorBarcode}
                              store={previewStore}
                              interactive
                              activeSection={activeLabelSection}
                              onSectionSelect={setActiveLabelSection}
                            />
                          )}
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-gray-300 font-mono whitespace-nowrap select-none pointer-events-none">
                          {LABEL_W_MM}×{LABEL_H_MM} mm
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-center gap-1.5 mt-8">
                        {layoutForm.label_section_order.map(id => {
                          const short = LABEL_SECTION_META.find(m => m.id === id)?.short ?? id;
                          const isActive = activeLabelSection === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setActiveLabelSection(id)}
                              className={\`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 \\\${
                                isActive
                                  ? 'bg-secondary-600 text-white border-secondary-600 shadow-brand'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-secondary-300 hover:text-secondary-600 shadow-soft'
                              }\`}
                            >
                              {short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/60">
                <p className="text-[11px] text-gray-400">Exchange rate required for LBP preview — Admin → Store → Regional</p>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button type="button" onClick={resetLayout} disabled={savingLayout} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 transition-colors">Reset</button>
                  <button type="button" onClick={() => void saveLayout()} disabled={savingLayout} className="px-4 py-1.5 text-xs font-bold text-white bg-secondary-600 rounded-lg hover:bg-secondary-700 disabled:opacity-50 transition-colors shadow-sm">{savingLayout ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'promotion' && (
          <div className="px-3 pb-4 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-soft p-4 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Promotion Text</label>
                <div className="relative">
                  <PaintBrushIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={promoText} onChange={(e) => setPromoText(e.target.value.toUpperCase())} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all font-bold text-red-600" placeholder="WEEKEND FRENZY!" />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Product Origin</label>
                <div className="relative">
                  <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={promoOrigin} onChange={(e) => setPromoOrigin(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 transition-all font-medium text-gray-700" placeholder="Product of Australia" />
                </div>
              </div>
              <div className="flex-shrink-0">
                 <Button onClick={() => setShowPreview(true)} disabled={selected.size === 0} variant="primary" size="sm" className="bg-secondary-600 hover:bg-secondary-700 h-[42px] px-6 rounded-xl shadow-lg hover:shadow-xl transition-all" leftIcon={<PrinterIcon className="w-5 h-5" />}>Generate Posters</Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'shelf' && (
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Label Preview</p>
                {selectedProducts.length > 0 && (
                  <p className="text-[10px] text-gray-400 tabular-nums">{carouselOffset + 1}–{Math.min(carouselOffset + CAROUSEL_VISIBLE, selectedProducts.length)} of {selectedProducts.length}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCarouselOffset(o => Math.max(0, o - 1))} disabled={!canCarouselLeft} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 bg-white shadow-sm"><ChevronLeftIcon className="w-4 h-4" /></button>
                <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden" style={{ height: scaledLabelH }}>
                  {selectedProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center w-full gap-1.5"><TagIcon className="w-6 h-6 text-gray-300" /><p className="text-sm font-semibold text-gray-400">No selection</p></div>
                  ) : (
                    visibleCarouselLabels.map(p => (
                      <div key={p.product_id} style={{ width: scaledLabelW, height: scaledLabelH, flexShrink: 0, overflow: 'hidden', borderRadius: 5 }}>
                        <div style={{ transform: \`scale(\\\${CAROUSEL_SCALE})\`, transformOrigin: 'top left', width: mmToPx(LABEL_W_MM), height: mmToPx(LABEL_H_MM) }}>
                          <LabelCard storeName={previewStore?.name ?? ''} productName={p.name} price={Number(p.sale_price ?? p.list_price ?? 0)} currency={currency} barcode={p.barcode} store={previewStore} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button type="button" onClick={() => setCarouselOffset(o => Math.min(o + 1, Math.max(0, selectedProducts.length - CAROUSEL_VISIBLE)))} disabled={!canCarouselRight} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-25 bg-white shadow-sm"><ChevronRightIcon className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {activeTab === 'promotion' && (
             <div className="flex-shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex flex-col items-center justify-center overflow-auto border-b border-gray-200">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Poster Preview</p>
               {selected.size > 0 ? (
                 <div className="relative shadow-2xl scale-[0.3] origin-center -my-[350px]">
                   <PromotionCard storeName={store?.name ?? 'STORE NAME'} productName={selectedProducts[0]?.name ?? 'PRODUCT NAME'} price={selectedProducts[0]?.sale_price ?? selectedProducts[0]?.list_price ?? 0} unit={selectedProducts[0]?.unit_of_measure || 'kilo'} origin={promoOrigin} promoText={promoText} />
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center"><TagIcon className="w-10 h-10 mb-2" /><p className="text-sm font-bold">Select products to preview poster</p></div>
               )}
             </div>
          )}

          {/* SHARED Product List */}
          <div className="flex-1 flex flex-col min-h-0 bg-white border-t border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="labels-search" type="text" placeholder="Search products..." value={search} onChange={e => handleSearchChange(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary-500 outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-secondary-200 border-t-secondary-600 rounded-full animate-spin" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr>
                      <th className="w-10 px-4 py-3"><button onClick={toggleAll} className={\`w-5 h-5 rounded border-2 flex items-center justify-center \\\${allOnPageSelected ? 'bg-secondary-600 border-secondary-600' : 'border-gray-300'}\`}>{allOnPageSelected && <CheckIcon className="w-3 h-3 text-white" />}</button></th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Product</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">SKU</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No products found</td></tr>
                    ) : (
                      products.map(p => {
                        const isSelected = selected.has(p.product_id);
                        return (
                          <tr key={p.product_id} onClick={() => toggleOne(p.product_id)} className={\`cursor-pointer transition-colors \\\${isSelected ? 'bg-secondary-50' : 'hover:bg-gray-50'}\`}>
                            <td className="px-4 py-3"><div className={\`w-5 h-5 rounded border-2 flex items-center justify-center \\\${isSelected ? 'bg-secondary-600 border-secondary-600' : 'border-gray-300'}\`}>{isSelected && <CheckIcon className="w-3 h-3 text-white" />}</div></td>
                            <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.sku || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">{currency} {Number(p.sale_price ?? p.list_price ?? 0).toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm flex-shrink-0">
                <span className="text-gray-500 text-xs">{totalProducts === 0 ? 'No products' : \`\\\${(currentPage - 1) * PAGE_SIZE + 1}–\\\${Math.min(currentPage * PAGE_SIZE, totalProducts)} of \\\${totalProducts}\`}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">‹</button>
                  {pageNumbers.map((n, i) => n === '...' ? <span key={\`ellipsis-\\\${i}\`} className="px-1 text-gray-400 text-xs">…</span> : <button key={n} onClick={() => setCurrentPage(n as number)} className={\`w-7 h-7 rounded text-xs font-medium \\\${n === currentPage ? 'bg-secondary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}\`}>{n}</button>)}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showPreview && store && previewStore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center flex-shrink-0"><PrinterIcon className="w-4 h-4 text-secondary-600" /></div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm leading-tight">Print Preview</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedProducts.length} label{selectedProducts.length !== 1 ? 's' : ''} · {paper.label} · {cols} per row</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <button id="modal-print-labels" onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-semibold hover:bg-secondary-700 shadow-sm"><PrinterIcon className="w-4 h-4" />Print</button>
                <button id="modal-close-preview" onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><XMarkIcon className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="overflow-auto bg-gray-100 p-6 flex-1">
              <div ref={printRef} className="shadow-lg mx-auto" style={{ width: 'fit-content' }}>
                {activeTab === 'shelf' ? <PrintPreview products={selectedProducts} store={previewStore} /> : <PromotionPrintPreview products={selectedProducts} store={previewStore} promoText={promoText} origin={promoOrigin} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
\`;

fs.writeFileSync(path, before + newReturn, 'utf8');
console.log('Success');
