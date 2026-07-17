// =========================================================================
// CONFIGURACIÓN GLOBAL (Pega aquí tu Web App URL que termina en /exec)
// =========================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbzDATdDglHIU7eY9XCXzu_HOetV9q4FoYlzDwK5uV1tCJJqahERHtVyTtx1H_23Dlw/exec";

const app = {
    data: { inventario: [], ventas: [], ingresos: [], egresos: [], abonos: [], cuentas_pagar: [] },
    chartInstance: null,

    init() {
        this.loadDashboardData();
        document.getElementById('venta-fecha').valueAsDate = new Date();
        document.getElementById('egreso-fecha').valueAsDate = new Date();
        document.getElementById('abono-fecha').valueAsDate = new Date();
        document.getElementById('deuda-prov-fecha').valueAsDate = new Date();
        document.getElementById('pagar-prov-fecha').valueAsDate = new Date();
    },

    loadView(viewName) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewName}`).classList.remove('hidden');
        const titles = { 'cobranzas': 'Cuentas x Cobrar (Pacientes)', 'proveedores': 'Cuentas x Pagar (Proveedores)' };
        document.getElementById('view-title').innerText = titles[viewName] || viewName.charAt(0).toUpperCase() + viewName.slice(1);
    },

    toggleModal(modalId) {
        const modal = document.getElementById(modalId);
        if(modal.classList.contains('hidden')){
            modal.classList.remove('hidden');
            if(modalId === 'modal-ventas') {
                document.getElementById('auto-id-venta').value = 'V-' + Date.now();
                document.getElementById('venta-deuda').innerText = '$0.00';
            }
            if(modalId === 'modal-egreso') document.getElementById('auto-id-egreso').value = 'E-' + Date.now();
            if(modalId === 'modal-deuda-proveedor') document.getElementById('auto-id-deuda').value = 'DP-' + Date.now();
        } else {
            modal.classList.add('hidden');
        }
    },

    calcDeuda() {
        const total = Number(document.getElementById('venta-total').value) || 0;
        const abono = Number(document.getElementById('venta-abono').value) || 0;
        const deuda = total - abono;
        document.getElementById('venta-deuda').innerText = `$${deuda.toFixed(2)}`;
    },

    calcMoneda(origen, inputModificado) {
        let montoUsd = 0;
        let inputTasa, inputBs;
        if (origen === 'ventas') {
            montoUsd = Number(document.getElementById('venta-abono').value) || 0;
            inputTasa = document.getElementById('venta-tasa'); inputBs = document.getElementById('venta-bs');
        } else if (origen === 'abono') {
            montoUsd = Number(document.getElementById('abono-monto').value) || 0;
            inputTasa = document.getElementById('abono-tasa'); inputBs = document.getElementById('abono-bs');
        }
        if (montoUsd <= 0) return;
        if (inputModificado === 'tasa') {
            const tasa = Number(inputTasa.value) || 0;
            if (tasa > 0) inputBs.value = (montoUsd * tasa).toFixed(2);
        } else if (inputModificado === 'bs') {
            const bs = Number(inputBs.value) || 0;
            if (bs > 0) inputTasa.value = (bs / montoUsd).toFixed(4);
        }
    },

    toggleDescuento() {
        const isChecked = document.getElementById('abono-descuento').checked;
        const monedaSec = document.getElementById('abono-moneda-section');
        const metodoSelect = document.getElementById('abono-metodo');
        const justificacionInput = document.getElementById('abono-justificacion');
        const lblMonto = document.getElementById('lbl-abono-monto');

        if(isChecked) {
            monedaSec.classList.add('hidden');
            metodoSelect.classList.add('hidden');
            metodoSelect.disabled = true;
            justificacionInput.classList.remove('hidden');
            justificacionInput.disabled = false;
            lblMonto.innerText = "Monto a Condenar/Descontar (USD):";
        } else {
            monedaSec.classList.remove('hidden');
            metodoSelect.classList.remove('hidden');
            metodoSelect.disabled = false;
            justificacionInput.classList.add('hidden');
            justificacionInput.disabled = true;
            lblMonto.innerText = "Monto a Abonar (USD):";
        }
    },

    setLoading(state) {
        document.getElementById('loading-indicator').style.display = state ? 'block' : 'none';
    },

    async loadDashboardData() {
        this.setLoading(true);
        try {
            const response = await fetch(`${API_URL}?action=getDashboard`);
            const result = await response.json();
            this.data = result;
            if(!this.data.cuentas_pagar) this.data.cuentas_pagar = [];
            this.renderAll();
        } catch (error) {
            console.error(error);
            alert("Error conectando con Google Sheets. Verifica la URL de Apps Script.");
        }
        this.setLoading(false);
    },

    async submitForm(event, sheetName) {
        event.preventDefault();
        if(sheetName === 'Ventas'){
            const total = Number(document.getElementById('venta-total').value);
            const abono = Number(document.getElementById('venta-abono').value);
            if(abono > total) return alert("El abono inicial no puede ser mayor al Costo Total.");
        }
        this.setLoading(true);
        const form = event.target;
        const dataObj = Object.fromEntries(new FormData(form).entries());

        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'insert', sheet: sheetName, data: dataObj }) });
            const result = await response.json();
            if(result.status === 'success'){
                form.reset();
                let modalStr = `modal-${sheetName.toLowerCase() === 'egresos' ? 'egreso' : (sheetName === 'Cuentas_Pagar' ? 'deuda-proveedor' : sheetName.toLowerCase())}`;
                this.toggleModal(modalStr);
                await this.loadDashboardData();
            }
        } catch (error) { console.error(error); }
        this.setLoading(false);
    },

    openAbonoModal(idVenta, cliente, saldo) {
        document.getElementById('abono-id-venta').value = idVenta;
        document.getElementById('abono-cliente').value = cliente;
        document.getElementById('lbl-abono-cliente').innerText = cliente;
        document.getElementById('lbl-abono-deuda').innerText = `$${Number(saldo).toFixed(2)}`;
        document.getElementById('abono-descuento').checked = false;
        this.toggleDescuento();
        this.toggleModal('modal-abono');
    },

    async submitAbono(event) {
        event.preventDefault();
        const abonoInput = Number(document.getElementById('abono-monto').value);
        const deudaMax = Number(document.getElementById('lbl-abono-deuda').innerText.replace('$',''));
        if (abonoInput > deudaMax) return alert("El monto no puede superar la deuda actual.");

        this.setLoading(true);
        const form = event.target;
        const formData = new FormData(form);
        
        if(!document.getElementById('abono-descuento').checked) {
            formData.set('Es_Descuento', 'false');
        }

        const dataObj = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'abono', data: dataObj }) });
            const result = await response.json();
            if(result.status === 'success'){
                form.reset();
                this.toggleModal('modal-abono');
                await this.loadDashboardData();
            }
        } catch (error) { console.error(error); }
        this.setLoading(false);
    },

    openPagarProvModal(idDeuda, proveedor, saldo) {
        document.getElementById('pagar-prov-id').value = idDeuda;
        document.getElementById('pagar-prov-nombre').value = proveedor;
        document.getElementById('lbl-pagar-prov').innerText = proveedor;
        document.getElementById('lbl-pagar-deuda').innerText = `$${Number(saldo).toFixed(2)}`;
        this.toggleModal('modal-pagar-proveedor');
    },

    async submitAbonoProveedor(event) {
        event.preventDefault();
        const abonoInput = Number(document.getElementById('pagar-prov-monto').value);
        const deudaMax = Number(document.getElementById('lbl-pagar-deuda').innerText.replace('$',''));
        if (abonoInput > deudaMax) return alert("El pago no puede superar la deuda actual.");

        this.setLoading(true);
        const form = event.target;
        const dataObj = Object.fromEntries(new FormData(form).entries());

        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'abono_proveedor', data: dataObj }) });
            const result = await response.json();
            if(result.status === 'success'){
                form.reset();
                this.toggleModal('modal-pagar-proveedor');
                await this.loadDashboardData();
            }
        } catch (error) { console.error(error); }
        this.setLoading(false);
    },

    renderAll() {
        this.renderInventory(this.data.inventario);
        this.renderVentas(this.data.ventas);
        this.renderCobranzas(this.data.ventas);
        this.renderProveedores(this.data.cuentas_pagar);
        this.renderEgresos(this.data.egresos);
        this.calculateFinancials();
    },

    renderInventory(items) {
        const tbody = document.getElementById('table-inventory');
        tbody.innerHTML = items.map(item => `
            <tr class="hover:bg-gray-50">
                <td class="p-3 font-medium">${item.ID || ''}</td>
                <td class="p-3">${item.Categoria || ''}</td>
                <td class="p-3">${item.Marca || ''} / ${item.Modelo || ''}</td>
                <td class="p-3">${item.Esfera || '-'}</td>
                <td class="p-3">${item.Cilindro || '-'}</td>
                <td class="p-3">${item.Eje || '-'}</td>
                <td class="p-3 font-bold ${item.Stock <= 5 ? 'text-red-500' : 'text-green-600'}">${item.Stock || 0}</td>
                <td class="p-3">$${item.Precio_Venta || 0}</td>
            </tr>
        `).join('');
    },

    filterInventory() {
        const term = document.getElementById('search-inventory').value.toLowerCase();
        const filtered = this.data.inventario.filter(i => 
            (i.ID && i.ID.toLowerCase().includes(term)) || (i.Marca && i.Marca.toLowerCase().includes(term)) || (i.Modelo && i.Modelo.toLowerCase().includes(term))
        );
        this.renderInventory(filtered);
    },

    renderVentas(ventas) {
        document.getElementById('table-ventas').innerHTML = ventas.map(venta => {
            const estadoColor = venta.Estado === 'Pagado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            const bsStr = venta.Monto_Bs ? `Bs ${venta.Monto_Bs}<br><span class="text-xs text-gray-400">Tasa: ${venta.Tasa_Cambio}</span>` : '-';
            return `
            <tr class="hover:bg-gray-50">
                <td class="p-3 font-medium text-blue-600">${venta.ID_Venta}</td>
                <td class="p-3">${new Date(venta.Fecha).toLocaleDateString()}</td>
                <td class="p-3">${venta.Cliente}</td>
                <td class="p-3 font-bold">$${venta.Total}</td>
                <td class="p-3 text-green-600">$${venta.Abono_Inicial}</td>
                <td class="p-3 text-blue-600 leading-tight">${bsStr}</td>
                <td class="p-3 text-red-500">$${venta.Saldo_Pendiente}</td>
                <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${estadoColor}">${venta.Estado}</span></td>
            </tr>`
        }).join('');
    },

    renderCobranzas(ventas) {
        const deudores = ventas.filter(v => Number(v.Saldo_Pendiente) > 0);
        document.getElementById('table-cobranzas').innerHTML = deudores.map(venta => `
            <tr class="hover:bg-gray-50">
                <td class="p-3 font-medium text-blue-600">${venta.ID_Venta}</td>
                <td class="p-3 font-bold">${venta.Cliente}</td>
                <td class="p-3">$${venta.Total}</td>
                <td class="p-3 font-bold text-red-600">$${venta.Saldo_Pendiente}</td>
                <td class="p-3">
                    <button onclick="app.openAbonoModal('${venta.ID_Venta}', '${venta.Cliente}', ${venta.Saldo_Pendiente})" class="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-xs font-bold">Abonar/Descontar</button>
                </td>
            </tr>`
        ).join('');
    },

    renderProveedores(proveedores) {
        if(!proveedores) return;
        const pendientes = proveedores.filter(p => Number(p.Saldo_Pendiente) > 0);
        document.getElementById('table-proveedores').innerHTML = pendientes.map(p => `
            <tr class="hover:bg-gray-50">
                <td class="p-3 font-medium text-red-600">${p.ID_Deuda}</td>
                <td class="p-3">${new Date(p.Fecha).toLocaleDateString()}</td>
                <td class="p-3 font-bold">${p.Proveedor}</td>
                <td class="p-3 text-sm">${p.Concepto}</td>
                <td class="p-3">$${p.Monto_Total}</td>
                <td class="p-3 font-bold text-red-600">$${p.Saldo_Pendiente}</td>
                <td class="p-3">
                    <button onclick="app.openPagarProvModal('${p.ID_Deuda}', '${p.Proveedor}', ${p.Saldo_Pendiente})" class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs font-bold">Pagar</button>
                </td>
            </tr>`
        ).join('');
    },

    renderEgresos(egresos) {
        document.getElementById('table-egresos').innerHTML = egresos.map(egreso => `
            <tr class="hover:bg-gray-50 text-red-700">
                <td class="p-3">${egreso.ID}</td>
                <td class="p-3">${new Date(egreso.Fecha).toLocaleDateString()}</td>
                <td class="p-3">${egreso.Concepto}</td>
                <td class="p-3">${egreso.Categoria}</td>
                <td class="p-3 font-bold">-$${egreso.Monto}</td>
            </tr>`
        ).join('');
    },

    calculateFinancials() {
        const totalIngresos = this.data.ingresos.reduce((acc, curr) => acc + Number(curr.Monto || 0), 0);
        const totalEgresos = this.data.egresos.reduce((acc, curr) => acc + Number(curr.Monto || 0), 0);
        const neto = totalIngresos - totalEgresos;
        const totalPorCobrar = this.data.ventas.reduce((acc, curr) => acc + Number(curr.Saldo_Pendiente || 0), 0);
        const totalPorPagar = (this.data.cuentas_pagar || []).reduce((acc, curr) => acc + Number(curr.Saldo_Pendiente || 0), 0);

        document.getElementById('dash-ingresos').innerText = `$${totalIngresos.toFixed(2)}`;
        document.getElementById('dash-egresos').innerText = `$${totalEgresos.toFixed(2)}`;
        document.getElementById('dash-balance').innerText = `$${neto.toFixed(2)}`;
        document.getElementById('dash-cobrar').innerText = `$${totalPorCobrar.toFixed(2)}`;
        document.getElementById('dash-pagar').innerText = `$${totalPorPagar.toFixed(2)}`;

        this.updateChart(totalIngresos, totalEgresos, totalPorCobrar, totalPorPagar);
    },

    updateChart(ingresos, egresos, porCobrar, porPagar) {
        const ctx = document.getElementById('financeChart').getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Métricas Financieras (USD)'],
                datasets: [
                    { label: 'Caja Ingresos', data: [ingresos], backgroundColor: 'rgba(59, 130, 246, 0.8)' },
                    { label: 'Cuentas x Cobrar (Calle)', data: [porCobrar], backgroundColor: 'rgba(234, 179, 8, 0.8)' },
                    { label: 'Cuentas x Pagar (Deudas)', data: [porPagar], backgroundColor: 'rgba(153, 27, 27, 0.8)' },
                    { label: 'Caja Egresos', data: [egresos], backgroundColor: 'rgba(239, 68, 68, 0.8)' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};

window.onload = () => app.init();
