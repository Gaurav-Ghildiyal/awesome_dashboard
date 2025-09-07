/** @odoo-module **/

import { Component, onMounted, useState } from "@odoo/owl";
import { rpc } from "web.rpc";
import { registry } from "@web/core/registry";

class AwesomeDashboard extends Component {
    static template = "awesome_dashboard.AwesomeDashboard";

    setup() {
        this.state = useState({ categories: {} });
        onMounted(() => {
            this.fetchData();
            this.initDragDrop();
            this.startAutoRefresh();
        });
    }

    async fetchData() {
        try {
            const orders = await rpc.query({
                model: "sale.order",
                method: "search_read",
                args: [[["state", "in", ["sale", "done"]]]],
                fields: ["order_line", "amount_total"],
            });

            const summary = {};
            orders.forEach(order => {
                order.order_line.forEach(line => {
                    const category = line.cogs_category || "Uncategorized";
                    if (!summary[category]) summary[category] = { revenue: 0, cogs: 0 };
                    summary[category].revenue += line.price_subtotal;
                    summary[category].cogs += line.cogs || 0;
                });
            });

            this.state.categories = summary;
            this.saveOffline(summary);

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            const offlineData = await this.loadOffline();
            if (offlineData) this.state.categories = offlineData;
        }
    }

    startAutoRefresh() {
        setInterval(() => this.fetchData(), 10000);
    }

    initDragDrop() {
        const container = document.getElementById("dashboard-widgets");
        let dragItem = null;
        container.addEventListener("dragstart", e => dragItem = e.target);
        container.addEventListener("dragover", e => e.preventDefault());
        container.addEventListener("drop", e => {
            e.preventDefault();
            if (dragItem && e.target.classList.contains("kpi-card")) {
                container.insertBefore(dragItem, e.target.nextSibling);
                dragItem = null;
            }
        });
        container.querySelectorAll(".kpi-card").forEach(card => card.setAttribute("draggable", true));
    }

    async saveOffline(data) {
        if (!window.indexedDB) return;
        const db = await this.openDB();
        const tx = db.transaction("dashboard", "readwrite");
        tx.objectStore("dashboard").put({ id: 1, data });
        tx.done;
    }

    async loadOffline() {
        if (!window.indexedDB) return null;
        const db = await this.openDB();
        const tx = db.transaction("dashboard", "readonly");
        const result = await tx.objectStore("dashboard").get(1);
        return result ? result.data : null;
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("SalesDashboardDB", 1);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("dashboard")) db.createObjectStore("dashboard", { keyPath: "id" });
            };
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event.target.error);
        });
    }
}

registry.category("actions").add("awesome_dashboard.dashboard", AwesomeDashboard);
