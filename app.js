// =========================================================================
// CONFIGURACIÓN GLOBAL (EDÍTALO CON TU URL DE APPS SCRIPT)
// =========================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbw-sT5ObrEYEiH7q5aBZwRFZ0aB7sH3eCL0UOhWrgtHiJNbpnH5jiFWVi0DCNTDHcYv/exec";

const app = {
    data: {
        inventario: [],
        ventas: [],
        ingresos: [],
        egresos: []
    },
    chartInstance: null,

    init() {
        this.loadDashboardData();
        // Auto-fill dates
        document.getElementById('venta-fecha').valueAsDate = new Date();
        document.getElementById('egreso-fecha').valueAsDate = new Date();
    },

    loadView(viewName) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewName}`).classList.remove('hidden');
        document.getElementById('view-title').innerText = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    },

    toggleModal(modalId) {
        const modal = document.getElementById(modalId);
        if(modal.classList.contains('hidden')){
            modal.classList.remove('hidden');
            if(modalId === 'modal-ventas') document.getElementById('auto-id-venta').value = 'V-' + Date.now();
            if(modalId === 'modal-egreso') document.getElementById('auto-id-egreso').value = 'E-' + Date.now();
        } else {
            modal.classList.add('hidden');
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
            this.renderAll();
        } catch (error) {
            console.error("Error fetching data:", error);
            alert("Error de conexión con Google Sheets.");
        }
        this.setLoading(false);
    },

    async submitForm(event, sheetName) {
        event.preventDefault();
        this.setLoading(true);
        
        const form = event.target;
        const formData = new FormData(form);
        const dataObj = Object.fromEntries(formData.entries());

        const payload = {
            action: 'insert',
            sheet: sheetName,
            data: dataObj
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if(result.status === 'success'){
                form.reset();
                this.toggleModal(`modal-${sheetName.toLowerCase() === 'egresos' ? 'egreso' : sheetName.toLowerCase()}`);
                await this.loadDashboardData(); // Recargar datos frescos
            } else {
                alert("Error de Base de Datos: " + result.message);
            }
        } catch (error) {
            console.error(error);
            alert("Error en la petición POST.");
        }
        this.setLoading(false);
    },

    renderAll() {
        this.renderInventory(this.data.inventario);
        this.renderVentas(this.data.ventas);
        this.renderEgresos(this.data.egresos);
        this.calculateFinancials();
    },

    renderInventory(items) {
        const tbody = document.getElementById('table-inventory');
        tbody.innerHTML = '';
        items.forEach(item => {
            tbody.innerHTML += `
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
            `;
        });
    },

    filterInventory() {
        const term = document.getElementById('search-inventory').value.toLowerCase();
        const filtered = this.data.inventario.filter(item => 
            (item.ID && item.ID.toLowerCase().includes(term)) ||
            (item.Marca && item.Marca.toLowerCase().includes(term)) ||
            (item.Modelo && item.Modelo.toLowerCase().includes(term)) ||
            (item.Categoria && item.Categoria.toLowerCase().includes(term))
        );
        this.renderInventory(filtered);
    },

    renderVentas(ventas) {
        const tbody = document.getElementById('table-ventas');
        tbody.innerHTML = '';
        ventas.forEach(venta => {
            const f = new Date(venta.Fecha);
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 font-medium text-blue-600">${venta.ID_Venta || ''}</td>
                    <td class="p-3">${f.toLocaleDateString() || ''}</td>
                    <td class="p-3">${venta.Cliente || ''}</td>
                    <td class="p-3">${venta.ID_Producto || ''}</td>
                    <td class="p-3">${venta.Cantidad || ''}</td>
                    <td class="p-3 font-bold">$${venta.Total || 0}</td>
                    <td class="p-3">${venta.Metodo_Pago || ''}</td>
                </tr>
            `;
        });
    },

    renderEgresos(egresos) {
        const tbody = document.getElementById('table-egresos');
        tbody.innerHTML = '';
        egresos.forEach(egreso => {
            const f = new Date(egreso.Fecha);
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 text-red-700">
                    <td class="p-3">${egreso.ID || ''}</td>
                    <td class="p-3">${f.toLocaleDateString() || ''}</td>
                    <td class="p-3">${egreso.Concepto || ''}</td>
                    <td class="p-3">${egreso.Categoria || ''}</td>
                    <td class="p-3 font-bold">-$${egreso.Monto || 0}</td>
                </tr>
            `;
        });
    },

    calculateFinancials() {
        const totalIngresos = this.data.ingresos.reduce((acc, curr) => acc + Number(curr.Monto || 0), 0);
        const totalEgresos = this.data.egresos.reduce((acc, curr) => acc + Number(curr.Monto || 0), 0);
        const neto = totalIngresos - totalEgresos;

        document.getElementById('dash-ingresos').innerText = `$${totalIngresos.toFixed(2)}`;
        document.getElementById('dash-egresos').innerText = `$${totalEgresos.toFixed(2)}`;
        document.getElementById('dash-balance').innerText = `$${neto.toFixed(2)}`;

        this.updateChart(totalIngresos, totalEgresos);
    },

    updateChart(ingresos, egresos) {
        const ctx = document.getElementById('financeChart').getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ingresos vs Egresos Globales'],
                datasets: [
                    {
                        label: 'Ingresos',
                        data: [ingresos],
                        backgroundColor: 'rgba(59, 130, 246, 0.7)'
                    },
                    {
                        label: 'Egresos',
                        data: [egresos],
                        backgroundColor: 'rgba(239, 68, 68, 0.7)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
};

window.onload = () => app.init();
