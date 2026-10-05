'use strict';
(function () {
  const api = window.parishPrinter;
  if (api?.version) api.version().then(version => {
    const label = document.getElementById('appVersion');
    label.textContent = `Versión ${version}`;
    label.hidden = false;
  }).catch(() => {});
  let printing = false;
  let pendingSelection = null;
  const button = document.getElementById('printerSettingsButton');
  const dialog = document.getElementById('printerSettingsDialog');
  const select = document.getElementById('savedPrinter');
  const status = document.getElementById('printerStatus');
  const error = document.getElementById('printerSettingsError');
  const save = document.getElementById('savePrinter');
  window.isEnvelopePrinting = () => printing;

  function fitEnvelopes() {
    for (const recipient of document.querySelectorAll('#printRoot .print-recipient')) {
      const measure=document.createElement('div');
      measure.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;width:58mm;line-height:1.2;color:#111;overflow-wrap:anywhere';
      measure.style.fontFamily=getComputedStyle(document.body).fontFamily;
      measure.innerHTML=recipient.innerHTML;
      for(const child of measure.children) {
        const name=child.className;
        if(name==='print-name') child.style.cssText+=';font-size:11pt;font-weight:900;text-transform:uppercase;margin-bottom:2mm';
        if(name==='print-address') child.style.cssText+=';font-size:10pt;font-weight:800';
        if(name==='print-sector') child.style.cssText+=';font-size:10pt;margin-top:1.5mm';
        if(name==='print-parish') child.style.cssText+=';font-size:11pt;font-weight:900;margin-top:2mm';
      }
      measure.firstElementChild.style.cssText+=';font-size:11pt!important;text-transform:none!important;margin-bottom:1mm!important';
      document.body.append(measure);
      const maximum=42*96/25.4;
      const scale=Math.min(1,maximum/measure.getBoundingClientRect().height);
      measure.remove();
      recipient.style.setProperty('transform',`scale(${scale})`,'important');
    }
  }

  async function refreshLabel() {
    if (!api) { button.hidden = true; return; }
    try {
      const { printers, selected } = await api.list();
      const printer = printers.find(p => p.name === selected);
      status.textContent = printer ? `Impresora: ${printer.displayName}` : selected ? 'La impresora guardada no está disponible.' : 'Elige una impresora una sola vez.';
    } catch { status.textContent = 'No se pudo consultar la impresora.'; }
  }

  async function choosePrinter() {
    if (dialog.open) return false;
    error.textContent = '';
    const { printers, selected } = await api.list();
    select.replaceChildren();
    for (const printer of printers) {
      const option = document.createElement('option');
      option.value = printer.name;
      option.textContent = printer.displayName;
      select.append(option);
    }
    if (printers.some(p => p.name === selected)) select.value = selected;
    else {
      const systemDefault = printers.find(p => p.isDefault);
      if (systemDefault) select.value = systemDefault.name;
    }
    save.disabled = !printers.length;
    if (!printers.length) error.textContent = 'No hay impresoras instaladas. Añade una en la configuración de Windows y vuelve a intentar.';
    dialog.showModal();
    return new Promise(resolve => { pendingSelection = resolve; });
  }

  dialog.addEventListener('close', () => {
    if (pendingSelection) { pendingSelection(dialog.returnValue === 'saved'); pendingSelection = null; }
  });
  document.getElementById('cancelPrinter').addEventListener('click', () => dialog.close('cancelled'));
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await api.save(select.value);
      dialog.close('saved');
      refreshLabel();
    } catch (e) { error.textContent = e.message; }
    finally { save.disabled = select.options.length === 0; }
  });
  button.addEventListener('click', () => choosePrinter().catch(e => showToast(e.message)));

  window.requestEnvelopePrint = async function () {
    if (printing) return;
    if (!api) { fitEnvelopes(); window.print(); return; }
    printing = true;
    try {
      const info = await api.list();
      if (!info.selected || !info.printers.some(p => p.name === info.selected)) {
        if (!await choosePrinter()) return;
      }
      if (document.fonts) await document.fonts.ready;
      fitEnvelopes();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await api.print();
      showToast(result.message);
      if (result.code === 'PRINTER_UNAVAILABLE') refreshLabel();
    } catch (e) { showToast(`No se pudo imprimir: ${e.message}`); }
    finally { printing = false; }
  };
  refreshLabel();
})();
