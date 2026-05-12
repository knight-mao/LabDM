const STORE_KEY = "labdm.mvp.v1";

const statusMap = {
  in_stock: "在库",
  borrowed: "借出",
  maintenance: "维修",
  scrapped: "报废"
};

const actionMap = {
  seed: "初始化",
  create: "入库",
  borrow: "借用",
  return: "归还",
  maintenance: "报修",
  restore: "恢复在库",
  scrap: "报废"
};

const roleMap = {
  superadmin: "超级管理员",
  admin: "管理员",
  user: "学生"
};

const seed = {
  authVersion: 2,
  activeUserId: "",
  users: [
    { id: "u-knight", username: "Knight", password: "twd416", name: "Knight", email: "knight@lab.local", role: "superadmin", department: "中心实验室" },
    { id: "u-admin", username: "admin", password: "admin123", name: "管理员", email: "admin@lab.local", role: "admin", department: "中心实验室" },
    { id: "u-student", username: "student", password: "student123", name: "学生用户", email: "student@lab.local", role: "user", department: "课题组 A" }
  ],
  locations: [
    { id: "loc-chem", name: "化学实验室 A-203" },
    { id: "loc-bio", name: "生物实验室 B-115" },
    { id: "loc-store", name: "公共库房" }
  ],
  categories: ["精密仪器", "常规设备", "工具附件"],
  equipment: [
    {
      id: "eq-centrifuge-01",
      name: "高速冷冻离心机",
      model: "CF-16R",
      assetNo: "LAB-2026-001",
      category: "精密仪器",
      status: "in_stock",
      locationId: "loc-bio",
      currentHolderId: "",
      qrTagId: "tag-a8f2c1d4",
      nfcTagId: "",
      purchaseDate: "2025-09-01",
      price: 42000,
      imageUrl: "",
      dueAt: "",
      note: "转子使用后需清洁并登记。"
    },
    {
      id: "eq-scope-01",
      name: "体视显微镜",
      model: "SMZ-745",
      assetNo: "LAB-2026-002",
      category: "常规设备",
      status: "borrowed",
      locationId: "loc-chem",
      currentHolderId: "u-student",
      qrTagId: "tag-b6e7d920",
      nfcTagId: "nfc-b6e7d920",
      purchaseDate: "2024-04-18",
      price: 9600,
      imageUrl: "",
      dueAt: nextDate(3),
      note: "镜头防尘罩随设备归还。"
    },
    {
      id: "eq-balance-01",
      name: "万分之一电子天平",
      model: "FA2204B",
      assetNo: "LAB-2026-003",
      category: "精密仪器",
      status: "maintenance",
      locationId: "loc-store",
      currentHolderId: "",
      qrTagId: "tag-d3c41e88",
      nfcTagId: "",
      purchaseDate: "2023-11-06",
      price: 13800,
      imageUrl: "",
      dueAt: "",
      note: "等待校准。"
    }
  ],
  events: []
};

seed.events = seed.equipment.map((item) => ({
  id: crypto.randomUUID(),
  equipmentId: item.id,
  actorId: "u-admin",
  action: "seed",
  fromStatus: "",
  toStatus: item.status,
  occurredAt: new Date().toISOString(),
  dueAt: item.dueAt,
  note: "MVP 示例数据"
}));

let state = loadState();
let scannerStream = null;
let scannerTimer = null;
let modal = null;

const app = document.querySelector("#app");

window.addEventListener("popstate", render);
window.addEventListener("hashchange", render);

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-route],[data-action],[data-equipment]");
  if (!target) return;

  if (target.dataset.route) {
    event.preventDefault();
    navigate(target.dataset.route);
  }

  if (target.dataset.equipment) {
    event.preventDefault();
    navigate(`/equipment/${target.dataset.equipment}`);
  }

  if (target.dataset.action && target.tagName !== "SELECT") {
    event.preventDefault();
    handleAction(target.dataset.action, target);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.dataset.action === "switch-user") {
    state.activeUserId = target.value;
    saveState();
    render();
  }
  if (target.dataset.action === "change-role") {
    changeRole(target.dataset.id, target.value);
  }
  if (target.dataset.action === "change-department") {
    changeDepartment(target.dataset.id, target.value);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  handleSubmit(form);
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-label-select]")) updateSelectedLabelCount();
});

window.addEventListener("beforeunload", stopScanner);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

render();

function loadState() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return structuredClone(seed);
  try {
    const parsed = JSON.parse(raw);
    const merged = { ...structuredClone(seed), ...parsed };
    if (parsed.authVersion !== seed.authVersion) merged.activeUserId = "";
    merged.authVersion = seed.authVersion;
    merged.users = ensureSeedUsers(merged.users || []);
    return merged;
  } catch {
    return structuredClone(seed);
  }
}

function ensureSeedUsers(users) {
  const byUsername = new Map(users.map((user) => [user.username || user.name, user]));
  for (const seedUser of seed.users) {
    if (!byUsername.has(seedUser.username)) users.push(seedUser);
  }
  return users.map((user) => ({
    username: user.username || user.name,
    password: user.password || "123456",
    ...user
  }));
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentUser() {
  return state.users.find((user) => user.id === state.activeUserId) || state.users[0];
}

function isLoggedIn() {
  return Boolean(state.activeUserId && state.users.some((user) => user.id === state.activeUserId));
}

function isAdminUser() {
  return ["admin", "superadmin"].includes(currentUser().role);
}

function isSuperAdmin() {
  return currentUser().role === "superadmin";
}

function locationName(id) {
  return state.locations.find((loc) => loc.id === id)?.name || "未设置";
}

function userName(id) {
  if (!id) return "无";
  return state.users.find((user) => user.id === id)?.name || "未知用户";
}

function navigate(path) {
  stopScanner();
  history.pushState({}, "", path);
  render();
}

function route() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);
  return { path, parts };
}

function render() {
  if (!isLoggedIn()) {
    stopScanner();
    app.innerHTML = loginView();
    return;
  }

  const { path, parts } = route();
  const nav = [
    ["dashboard", "总览", "/"],
    ["equipment", "设备", "/equipment"],
    ["scan", "扫码", "/scan"],
    ["labels", "标签", "/labels"],
    ...(isAdminUser() ? [["admin", "录入", "/admin"]] : []),
    ...(isAdminUser() ? [["accounts", "账户", "/accounts"]] : [])
  ];

  let page = "";
  let title = "库存总览";
  let subtitle = "查看设备状态、借出情况和最近流水";
  let actions = "";

  if (path === "/" || path === "/dashboard") {
    page = dashboardView();
  } else if (path === "/equipment") {
    title = "设备台账";
    subtitle = "按名称、资产编号、分类和状态查询设备";
    actions = isAdminUser() ? `<button class="btn primary" data-route="/admin">新增设备</button>` : "";
    page = equipmentListView();
  } else if (parts[0] === "equipment" && parts[1]) {
    const equipment = findEquipment(parts[1]);
    title = equipment ? equipment.name : "设备不存在";
    subtitle = equipment ? `${equipment.assetNo} · ${equipment.model}` : "请检查链接或标签短码";
    page = equipment ? detailView(equipment) : notFoundView();
  } else if (parts[0] === "t" && parts[1]) {
    const equipment = state.equipment.find((item) => item.qrTagId === parts[1] || item.nfcTagId === parts[1]);
    page = equipment ? detailView(equipment) : notFoundView(parts[1]);
    title = equipment ? equipment.name : "标签未绑定";
    subtitle = equipment ? `标签 ${parts[1]}` : "该二维码或 NFC 标签还没有绑定设备";
  } else if (path === "/scan") {
    title = "扫码识别";
    subtitle = "使用摄像头扫描二维码，或输入标签短码";
    page = scanView();
  } else if (path === "/admin") {
    title = "设备录入";
    subtitle = "新增设备时自动生成不可猜测的标签短码";
    page = isAdminUser() ? adminView() : notFoundView();
  } else if (path === "/labels") {
    title = "标签打印";
    subtitle = "勾选需要打印的标签，打印时只输出已选二维码";
    actions = `<button class="btn primary no-print" data-action="print-selected">打印已选</button>`;
    page = labelsView();
  } else if (path === "/accounts") {
    title = "账户与类别管理";
    subtitle = isSuperAdmin() ? "管理管理员、学生账户和设备分类" : "管理学生账户和设备分类";
    page = accountsView();
  } else {
    page = notFoundView();
  }

  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">LD</div>
          <div>
            <h1>LabDM</h1>
            <p>实验室设备管理</p>
          </div>
        </div>
        <nav class="nav">
          ${nav
            .map(
              ([key, label, href]) =>
                `<button class="${isActive(href, path) ? "active" : ""}" data-route="${href}" title="${label}">
                  ${navIcon(key)}<span>${label}</span>
                </button>`
            )
            .join("")}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="toolbar">
            <span class="user-badge">${escapeHtml(currentUser().name)} · ${roleMap[currentUser().role]}</span>
            <button class="btn ghost" data-action="logout">退出</button>
            ${actions}
          </div>
        </header>
        ${page}
      </main>
    </div>
    ${modalView()}
  `;

  if (path === "/scan") startScanner();
}

function loginView() {
  const registerMode = window.location.pathname === "/register";
  return `
    <main class="login-page">
      <section class="login-card">
        <div class="brand">
          <div class="brand-mark">LD</div>
          <div>
            <h1>LabDM</h1>
            <p>实验室设备管理</p>
          </div>
        </div>
        ${
          registerMode
            ? `
        <form class="grid" data-form="self-register">
          <div class="field">
            <label>用户名</label>
            <input name="username" autocomplete="username" required />
          </div>
          <div class="field">
            <label>姓名</label>
            <input name="name" required />
          </div>
          <div class="field">
            <label>密码</label>
            <input name="password" type="password" autocomplete="new-password" required />
          </div>
          <div class="field">
            <label>邮箱</label>
            <input name="email" type="email" />
          </div>
          <div class="field">
            <label>部门/课题组</label>
            <input name="department" />
          </div>
          <button class="btn primary" type="submit">注册学生账户</button>
          <button class="btn ghost" type="button" data-route="/">返回登录</button>
        </form>`
            : `
        <form class="grid" data-form="login">
          <div class="field">
            <label>用户名</label>
            <input name="username" autocomplete="username" required />
          </div>
          <div class="field">
            <label>密码</label>
            <input name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="btn primary" type="submit">登录</button>
          <button class="btn ghost" type="button" data-route="/register">学生自助注册</button>
        </form>`
        }
      </section>
    </main>
  `;
}

function isActive(href, path) {
  if (href === "/") return path === "/" || path === "/dashboard";
  return path.startsWith(href);
}

function navIcon(key) {
  const icons = {
    dashboard: "▦",
    equipment: "□",
    scan: "⌕",
    admin: "+",
    labels: "▣",
    accounts: roleMap[currentUser().role] || "账户"
  };
  return `<span aria-hidden="true">${icons[key]}</span>`;
}

function dashboardView() {
  const stats = statusCounts();
  const recent = [...state.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);
  return `
    <section class="grid stats">
      ${statBlock("设备总数", state.equipment.length)}
      ${statBlock("在库", stats.in_stock || 0)}
      ${statBlock("借出", stats.borrowed || 0)}
      ${statBlock("维修", stats.maintenance || 0)}
    </section>
    <section class="workspace">
      <div class="panel">
        <div class="panel-head">
          <h3>当前借出</h3>
          <button class="btn ghost" data-route="/equipment">查看台账</button>
        </div>
        <div class="panel-body">
          ${equipmentTable(state.equipment.filter((item) => item.status === "borrowed"))}
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h3>最近流水</h3></div>
        <div class="panel-body timeline">
          ${recent.map(eventRow).join("") || `<div class="empty">暂无流水</div>`}
        </div>
      </aside>
    </section>
  `;
}

function statBlock(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function statusCounts() {
  return state.equipment.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
}

function equipmentListView() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const category = params.get("category") || "";
  const filtered = filterEquipment(q, status, category);

  return `
    <section class="panel">
      <div class="panel-body">
        <form class="filters" data-form="filters">
          <div class="field">
            <label>搜索</label>
            <input name="q" value="${escapeAttr(q)}" placeholder="名称、型号、资产编号、标签短码" />
          </div>
          <div class="field">
            <label>状态</label>
            <select name="status">
              <option value="">全部</option>
              ${Object.entries(statusMap).map(([key, label]) => `<option value="${key}" ${status === key ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>分类</label>
            <select name="category">
              <option value="">全部</option>
              ${state.categories.map((item) => `<option value="${escapeAttr(item)}" ${category === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
            </select>
          </div>
        </form>
        ${equipmentTable(filtered)}
      </div>
    </section>
  `;
}

function filterEquipment(q, status, category) {
  const keyword = q.trim().toLowerCase();
  return state.equipment.filter((item) => {
    const text = [item.name, item.model, item.assetNo, item.qrTagId, item.nfcTagId].join(" ").toLowerCase();
    return (!keyword || text.includes(keyword)) && (!status || item.status === status) && (!category || item.category === category);
  });
}

function equipmentTable(items) {
  if (!items.length) return `<div class="empty">没有匹配设备</div>`;
  return `
    <table>
      <thead>
        <tr>
          <th>设备</th>
          <th>状态</th>
          <th>位置</th>
          <th>持有人</th>
          <th>应还</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr class="clickable" data-equipment="${item.id}">
                <td><strong>${escapeHtml(item.name)}</strong><div class="meta">${escapeHtml(item.assetNo)} · ${escapeHtml(item.model)}</div></td>
                <td>${statusPill(item.status)}</td>
                <td>${escapeHtml(locationName(item.locationId))}</td>
                <td>${escapeHtml(userName(item.currentHolderId))}</td>
                <td>${item.dueAt ? escapeHtml(item.dueAt) : "无"}</td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function detailView(item) {
  const events = state.events
    .filter((event) => event.equipmentId === item.id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const canBorrow = item.status === "in_stock";
  const canReturn = item.status === "borrowed" && (isAdminUser() || item.currentHolderId === currentUser().id);
  const isAdmin = isAdminUser();
  const canRestoreScrapped = isAdmin && item.status === "scrapped";
  const url = tagUrl(item.qrTagId);

  return `
    <section class="workspace">
      <div class="panel">
        <div class="panel-head detail-title">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <div class="meta">${escapeHtml(item.assetNo)} · ${escapeHtml(item.category)}</div>
          </div>
          ${statusPill(item.status)}
        </div>
        <div class="panel-body grid">
          <dl class="kv">
            <dt>型号</dt><dd>${escapeHtml(item.model)}</dd>
            <dt>位置</dt><dd>${escapeHtml(locationName(item.locationId))}</dd>
            <dt>当前持有人</dt><dd>${escapeHtml(userName(item.currentHolderId))}</dd>
            <dt>应还日期</dt><dd>${item.dueAt || "无"}</dd>
            <dt>二维码短码</dt><dd><span class="label-code">${escapeHtml(item.qrTagId)}</span></dd>
            <dt>NFC短码</dt><dd>${item.nfcTagId ? `<span class="label-code">${escapeHtml(item.nfcTagId)}</span>` : "未绑定"}</dd>
            <dt>标签链接</dt><dd><span class="label-code">${escapeHtml(url)}</span></dd>
            <dt>备注</dt><dd>${escapeHtml(item.note || "无")}</dd>
          </dl>
          <div class="toolbar">
            ${canBorrow ? `<button class="btn primary" data-action="borrow" data-id="${item.id}">申请借用</button>` : ""}
            ${canReturn ? `<button class="btn primary" data-action="return" data-id="${item.id}">确认归还</button>` : ""}
            ${item.status !== "maintenance" && item.status !== "scrapped" ? `<button class="btn" data-action="maintenance" data-id="${item.id}">报修</button>` : ""}
            ${isAdmin && item.status === "maintenance" ? `<button class="btn" data-action="restore" data-id="${item.id}">恢复在库</button>` : ""}
            ${canRestoreScrapped ? `<button class="btn" data-action="restore" data-id="${item.id}">恢复在库</button>` : ""}
            ${canRestoreScrapped ? `<button class="btn" data-action="maintenance" data-id="${item.id}">转入维修</button>` : ""}
            ${isAdmin && item.status !== "scrapped" ? `<button class="btn danger" data-action="scrap" data-id="${item.id}">标记报废</button>` : ""}
            <button class="btn ghost" data-route="/labels">打印标签</button>
          </div>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h3>审计流水</h3></div>
        <div class="panel-body timeline">
          ${events.map(eventRow).join("") || `<div class="empty">暂无流水</div>`}
        </div>
      </aside>
    </section>
  `;
}

function scanView() {
  return `
    <section class="workspace">
      <div class="panel">
        <div class="panel-head"><h3>摄像头扫描</h3></div>
        <div class="panel-body scan-box">
          <div class="video-box" id="scan-video-box">正在准备摄像头</div>
          <div class="toolbar">
            <button class="btn primary" data-action="start-scan">开启扫描</button>
            <button class="btn" data-action="stop-scan">停止</button>
          </div>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h3>手动输入</h3></div>
        <div class="panel-body">
          <form class="grid" data-form="manual-tag">
            <div class="field">
              <label>标签短码或完整链接</label>
              <input name="tag" placeholder="tag-a8f2c1d4" required />
            </div>
            <button class="btn primary" type="submit">打开设备</button>
          </form>
        </div>
      </aside>
    </section>
  `;
}

function adminView() {
  if (!isAdminUser()) return notFoundView();
  return `
    <section class="panel">
      <div class="panel-body">
        <form class="form-grid" data-form="equipment">
          <div class="field">
            <label>设备名称</label>
            <input name="name" required placeholder="例如 高速冷冻离心机" />
          </div>
          <div class="field">
            <label>型号</label>
            <input name="model" required placeholder="例如 CF-16R" />
          </div>
          <div class="field">
            <label>资产编号</label>
            <input name="assetNo" required placeholder="LAB-2026-004" />
          </div>
          <div class="field">
            <label>分类</label>
            <select name="category" required>
              ${state.categories.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>放置位置</label>
            <select name="locationId" required>
              ${state.locations.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>购置日期</label>
            <input name="purchaseDate" type="date" />
          </div>
          <div class="field">
            <label>价格</label>
            <input name="price" type="number" min="0" step="0.01" />
          </div>
          <div class="field">
            <label>NFC短码</label>
            <input name="nfcTagId" placeholder="可留空，后续绑定" />
          </div>
          <div class="field wide">
            <label>备注</label>
            <textarea name="note" placeholder="使用注意事项、附件说明、验收要求"></textarea>
          </div>
          <div class="toolbar wide">
            <button class="btn primary" type="submit">保存并生成标签</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function labelsView() {
  return `
    <section class="panel">
      <div class="panel-head no-print">
        <h3>可打印标签</h3>
        <span class="meta" id="selected-label-count">已选 0 个</span>
      </div>
      <div class="panel-body">
        <div class="labels-grid">
          ${state.equipment.map(labelCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function labelCard(item) {
  const url = tagUrl(item.qrTagId);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  return `
    <article class="label-card" data-label-card>
      <label class="label-check no-print">
        <input type="checkbox" data-label-select value="${item.id}" />
        <span>选择打印</span>
      </label>
      <strong>${escapeHtml(item.name)}</strong>
      <span class="meta">${escapeHtml(item.assetNo)}</span>
      <img alt="${escapeAttr(item.name)} 二维码" src="${qr}" />
      <span class="label-code">${escapeHtml(item.qrTagId)}</span>
      <span class="label-code">${escapeHtml(url)}</span>
    </article>
  `;
}

function accountsView() {
  if (!isAdminUser()) return notFoundView();
  return `
    <section class="workspace">
      <div class="panel">
        <div class="panel-head"><h3>账户</h3></div>
        <div class="panel-body">
          ${accountsTable()}
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h3>新增账户</h3></div>
        <div class="panel-body">
          <form class="grid" data-form="account">
            <div class="field"><label>用户名</label><input name="username" required /></div>
            <div class="field"><label>姓名</label><input name="name" required /></div>
            <div class="field"><label>密码</label><input name="password" required type="password" /></div>
            <div class="field"><label>邮箱</label><input name="email" type="email" /></div>
            <div class="field"><label>部门/课题组</label><input name="department" /></div>
            <div class="field">
              <label>角色</label>
              <select name="role">
                ${isSuperAdmin() ? `<option value="admin">管理员</option>` : ""}
                <option value="user">学生</option>
              </select>
            </div>
            <button class="btn primary" type="submit">创建账户</button>
          </form>
        </div>
      </aside>
    </section>
    <section class="workspace account-lower">
      <div class="panel">
        <div class="panel-head"><h3>设备分类</h3></div>
        <div class="panel-body">
          <div class="category-list">
            ${state.categories.map((category) => `<span class="category-chip">${escapeHtml(category)}</span>`).join("")}
          </div>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h3>新增分类</h3></div>
        <div class="panel-body">
          <form class="grid" data-form="category">
            <div class="field"><label>分类名称</label><input name="category" required /></div>
            <button class="btn primary" type="submit">添加分类</button>
          </form>
        </div>
      </aside>
    </section>
  `;
}

function accountsTable() {
  return `
    <table>
      <thead><tr><th>用户</th><th>角色</th><th>部门</th><th>操作</th></tr></thead>
      <tbody>
        ${state.users.map((user) => {
          const canEditRole = isSuperAdmin() && user.id !== currentUser().id;
          const canManage = user.id !== currentUser().id && (isSuperAdmin() || user.role === "user");
          return `
            <tr>
              <td><strong>${escapeHtml(user.name)}</strong><div class="meta">${escapeHtml(user.username)} · ${escapeHtml(user.email || "无邮箱")}</div></td>
              <td>
                ${canEditRole ? `
                  <select data-action="change-role" data-id="${user.id}">
                    ${Object.entries(roleMap).filter(([role]) => role !== "superadmin").map(([role, label]) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${label}</option>`).join("")}
                  </select>
                ` : roleMap[user.role]}
              </td>
              <td>
                ${canManage || user.id === currentUser().id ? `
                  <input class="inline-input" data-action="change-department" data-id="${user.id}" value="${escapeAttr(user.department || "")}" placeholder="未设置" />
                ` : escapeHtml(user.department || "未设置")}
              </td>
              <td>
                ${canManage ? `<button class="btn" data-action="reset-password" data-id="${user.id}">重置密码</button>` : ""}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function notFoundView(tag = "") {
  return `
    <section class="panel">
      <div class="panel-body">
        <p>${tag ? `标签 ${escapeHtml(tag)} 未绑定。` : "没有找到对应设备。"}</p>
        <div class="toolbar">
          <button class="btn primary" data-route="/equipment">返回台账</button>
          <button class="btn" data-route="/admin">录入设备</button>
        </div>
      </div>
    </section>
  `;
}

function statusPill(status) {
  return `<span class="status ${status}">${statusMap[status] || status}</span>`;
}

function eventRow(event) {
  const equipment = findEquipment(event.equipmentId);
  return `
    <div class="event">
      <strong>${escapeHtml(actionMap[event.action] || event.action)} · ${escapeHtml(equipment?.name || "未知设备")}</strong>
      <span class="meta">${formatDateTime(event.occurredAt)} · ${escapeHtml(userName(event.actorId))}</span>
      <div class="meta">${event.fromStatus ? `${statusMap[event.fromStatus]} → ` : ""}${statusMap[event.toStatus] || event.toStatus}${event.dueAt ? ` · 应还 ${escapeHtml(event.dueAt)}` : ""}</div>
      ${event.note ? `<div>${escapeHtml(event.note)}</div>` : ""}
    </div>
  `;
}

function findEquipment(id) {
  return state.equipment.find((item) => item.id === id);
}

function tagUrl(tagId) {
  return `${window.location.origin}/t/${tagId}`;
}

function handleAction(action, target) {
  if (action === "close-modal") {
    modal = null;
    render();
    return;
  }

  if (action === "logout") {
    state.activeUserId = "";
    saveState();
    stopScanner();
    render();
    return;
  }

  if (action === "print-selected") return printSelectedLabels();

  if (action === "change-role") return changeRole(target.dataset.id, target.value);

  if (action === "reset-password") return resetPassword(target.dataset.id);

  if (action === "start-scan") {
    startScanner();
    return;
  }

  if (action === "stop-scan") {
    stopScanner();
    setScannerMessage("扫描已停止");
    return;
  }

  const id = target.dataset.id;
  const item = findEquipment(id);
  if (!item) return;

  if (action === "borrow") borrow(item);
  if (action === "return") returnEquipment(item);
  if (action === "maintenance") markMaintenance(item);
  if (action === "restore") transition(item, "restore", "in_stock", { holder: "", dueAt: "", note: "管理员确认维修完成" });
  if (action === "scrap") markScrap(item);
}

function handleSubmit(form) {
  const formType = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());

  if (formType === "filters") {
    const params = new URLSearchParams();
    if (data.q) params.set("q", data.q);
    if (data.status) params.set("status", data.status);
    if (data.category) params.set("category", data.category);
    navigate(`/equipment${params.toString() ? `?${params.toString()}` : ""}`);
    return;
  }

  if (formType === "manual-tag") {
    openTag(data.tag);
    return;
  }

  if (formType === "login") {
    login(data);
    return;
  }

  if (formType === "self-register") {
    selfRegister(data);
    return;
  }

  if (formType === "reset-password") {
    submitResetPassword(data);
    return;
  }

  if (formType === "borrow") {
    submitBorrow(data);
    return;
  }

  if (formType === "maintenance") {
    submitMaintenance(data);
    return;
  }

  if (formType === "scrap") {
    submitScrap(data);
    return;
  }

  if (formType === "equipment") {
    createEquipment(data);
    return;
  }

  if (formType === "account") {
    createAccount(data);
    return;
  }

  if (formType === "category") {
    createCategory(data);
  }
}

function login(data) {
  const username = data.username.trim();
  const password = data.password;
  const user = state.users.find((item) => item.username === username && item.password === password);
  if (!user) {
    toast("用户名或密码错误");
    return;
  }
  state.activeUserId = user.id;
  saveState();
  navigate("/");
}

function borrow(item) {
  if (item.requiresApproval) {
    toast("该设备需要审批，审批流程将在后续版本启用");
    return;
  }
  modal = { type: "borrow", equipmentId: item.id };
  render();
}

function returnEquipment(item) {
  const note = prompt("归还备注，可填写设备状态", "设备已归还");
  if (note === null) return;
  transition(item, "return", "in_stock", {
    holder: "",
    dueAt: "",
    note: note || "设备已归还"
  });
}

function markMaintenance(item) {
  modal = { type: "maintenance", equipmentId: item.id };
  render();
}

function markScrap(item) {
  if (!isAdminUser()) {
    toast("只有管理员可以标记报废");
    return;
  }
  modal = { type: "scrap", equipmentId: item.id };
  render();
}

function submitBorrow(data) {
  if (!modal || modal.type !== "borrow") return;
  const item = findEquipment(modal.equipmentId);
  if (!item || item.status !== "in_stock") return;
  const dueAt = data.dueAt || nextDate(7);
  modal = null;
  transition(item, "borrow", "borrowed", {
    holder: currentUser().id,
    dueAt,
    note: data.note?.trim() || `${currentUser().name} 借用`
  });
}

function submitMaintenance(data) {
  if (!modal || modal.type !== "maintenance") return;
  const item = findEquipment(modal.equipmentId);
  if (!item) return;
  modal = null;
  transition(item, "maintenance", "maintenance", {
    holder: "",
    dueAt: "",
    note: data.note?.trim() || "设备需要检修"
  });
}

function submitScrap(data) {
  if (!modal || modal.type !== "scrap") return;
  const item = findEquipment(modal.equipmentId);
  if (!item || !isAdminUser()) return;
  if (data.confirm !== item.assetNo) {
    toast("请输入资产编号确认报废");
    return;
  }
  modal = null;
  transition(item, "scrap", "scrapped", {
    holder: "",
    dueAt: "",
    note: data.note?.trim() || "管理员标记报废"
  });
}

function transition(item, action, toStatus, details) {
  const fromStatus = item.status;
  item.status = toStatus;
  item.currentHolderId = details.holder;
  item.dueAt = details.dueAt;
  state.events.push({
    id: crypto.randomUUID(),
    equipmentId: item.id,
    actorId: currentUser().id,
    action,
    fromStatus,
    toStatus,
    occurredAt: new Date().toISOString(),
    dueAt: details.dueAt,
    note: details.note
  });
  saveState();
  toast("状态已更新");
  render();
}

function createEquipment(data) {
  if (!isAdminUser()) {
    toast("只有管理员可以录入设备");
    return;
  }

  const item = {
    id: `eq-${crypto.randomUUID()}`,
    name: data.name.trim(),
    model: data.model.trim(),
    assetNo: data.assetNo.trim(),
    category: data.category,
    status: "in_stock",
    locationId: data.locationId,
    currentHolderId: "",
    qrTagId: `tag-${crypto.randomUUID().slice(0, 8)}`,
    nfcTagId: data.nfcTagId.trim(),
    purchaseDate: data.purchaseDate,
    price: Number(data.price || 0),
    imageUrl: "",
    dueAt: "",
    note: data.note.trim()
  };

  state.equipment.unshift(item);
  state.events.push({
    id: crypto.randomUUID(),
    equipmentId: item.id,
    actorId: currentUser().id,
    action: "create",
    fromStatus: "",
    toStatus: "in_stock",
    occurredAt: new Date().toISOString(),
    dueAt: "",
    note: "管理员录入设备"
  });
  saveState();
  toast("设备已录入，标签已生成");
  navigate(`/equipment/${item.id}`);
}

function createAccount(data) {
  if (!isAdminUser()) {
    toast("只有管理员可以创建账户");
    return;
  }
  if (data.role === "admin" && !isSuperAdmin()) {
    toast("只有超级管理员可以创建管理员");
    return;
  }
  const username = data.username.trim();
  if (state.users.some((user) => user.username === username)) {
    toast("用户名已存在");
    return;
  }
  state.users.push({
    id: `u-${crypto.randomUUID()}`,
    username,
    password: data.password,
    name: data.name.trim(),
    email: data.email.trim(),
    role: data.role,
    department: data.department.trim()
  });
  saveState();
  toast("账户已创建");
  render();
}

function selfRegister(data) {
  const username = data.username.trim();
  if (state.users.some((user) => user.username === username)) {
    toast("用户名已存在");
    return;
  }
  const user = {
    id: `u-${crypto.randomUUID()}`,
    username,
    password: data.password,
    name: data.name.trim(),
    email: data.email.trim(),
    role: "user",
    department: data.department.trim()
  };
  state.users.push(user);
  state.activeUserId = user.id;
  saveState();
  navigate("/");
}

function createCategory(data) {
  if (!isAdminUser()) {
    toast("只有管理员可以管理分类");
    return;
  }
  const category = data.category.trim();
  if (!category) return;
  if (state.categories.includes(category)) {
    toast("分类已存在");
    return;
  }
  state.categories.push(category);
  saveState();
  toast("分类已添加");
  render();
}

function changeRole(userId, role) {
  if (!isSuperAdmin()) {
    toast("只有超级管理员可以调整管理员类别");
    render();
    return;
  }
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.role === "superadmin") return;
  user.role = role;
  saveState();
  toast("角色已更新");
  render();
}

function changeDepartment(userId, department) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  const canManage = user.id === currentUser().id || isSuperAdmin() || (isAdminUser() && user.role === "user");
  if (!canManage) {
    toast("没有权限修改该用户部门");
    render();
    return;
  }
  user.department = department.trim();
  saveState();
}

function resetPassword(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.id === currentUser().id) return;
  if (!isSuperAdmin() && user.role !== "user") {
    toast("管理员只能重置学生密码");
    return;
  }
  modal = { type: "reset-password", userId };
  render();
}

function submitResetPassword(data) {
  if (!modal || modal.type !== "reset-password") return;
  const user = state.users.find((item) => item.id === modal.userId);
  if (!user) return;
  if (!data.password) {
    toast("请输入新密码");
    return;
  }
  user.password = data.password;
  saveState();
  modal = null;
  render();
  toast("密码已重置");
}

function printSelectedLabels() {
  const selected = [...document.querySelectorAll("[data-label-select]:checked")];
  if (!selected.length) {
    toast("请先勾选要打印的标签");
    return;
  }
  document.querySelectorAll("[data-label-card]").forEach((card) => card.classList.add("print-hidden"));
  selected.forEach((checkbox) => checkbox.closest("[data-label-card]")?.classList.remove("print-hidden"));
  window.print();
  document.querySelectorAll("[data-label-card]").forEach((card) => card.classList.remove("print-hidden"));
}

function updateSelectedLabelCount() {
  const el = document.querySelector("#selected-label-count");
  if (!el) return;
  const count = document.querySelectorAll("[data-label-select]:checked").length;
  el.textContent = `已选 ${count} 个`;
}

function modalView() {
  if (!modal) return "";
  if (modal.type === "reset-password") {
    const user = state.users.find((item) => item.id === modal.userId);
    if (!user) return "";
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div class="panel-head">
            <h3 id="reset-title">重置密码</h3>
            <button class="btn ghost" data-action="close-modal">关闭</button>
          </div>
          <div class="panel-body">
            <form class="grid" data-form="reset-password">
              <p class="meta">为 ${escapeHtml(user.name)} 设置新密码。</p>
              <div class="field">
                <label>新密码</label>
                <input name="password" type="password" autocomplete="new-password" required autofocus />
              </div>
              <button class="btn primary" type="submit">保存新密码</button>
            </form>
          </div>
        </section>
      </div>
    `;
  }
  if (modal.type === "borrow") {
    const item = findEquipment(modal.equipmentId);
    if (!item) return "";
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="borrow-title">
          <div class="panel-head">
            <h3 id="borrow-title">确认借用</h3>
            <button class="btn ghost" data-action="close-modal">关闭</button>
          </div>
          <div class="panel-body">
            <form class="grid" data-form="borrow">
              <p class="meta">${escapeHtml(item.name)} 将直接标记为出库，借用人为 ${escapeHtml(currentUser().name)}。</p>
              <div class="field">
                <label>预计归还日期</label>
                <input name="dueAt" type="date" value="${nextDate(7)}" required />
              </div>
              <div class="field">
                <label>借用备注</label>
                <textarea name="note" placeholder="可填写用途或实验项目"></textarea>
              </div>
              <button class="btn primary" type="submit">确认出库</button>
            </form>
          </div>
        </section>
      </div>
    `;
  }
  if (modal.type === "maintenance") {
    const item = findEquipment(modal.equipmentId);
    if (!item) return "";
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
          <div class="panel-head">
            <h3 id="maintenance-title">设备报修</h3>
            <button class="btn ghost" data-action="close-modal">关闭</button>
          </div>
          <div class="panel-body">
            <form class="grid" data-form="maintenance">
              <p class="meta">${escapeHtml(item.name)} 将转入维修状态。</p>
              <div class="field">
                <label>报修说明</label>
                <textarea name="note" required placeholder="请描述故障、异常现象或维修原因"></textarea>
              </div>
              <button class="btn primary" type="submit">提交报修</button>
            </form>
          </div>
        </section>
      </div>
    `;
  }
  if (modal.type === "scrap") {
    const item = findEquipment(modal.equipmentId);
    if (!item) return "";
    return `
      <div class="modal-backdrop" role="presentation">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="scrap-title">
          <div class="panel-head">
            <h3 id="scrap-title">确认报废</h3>
            <button class="btn ghost" data-action="close-modal">关闭</button>
          </div>
          <div class="panel-body">
            <form class="grid" data-form="scrap">
              <p class="meta">报废会记录审计流水。报废后管理员仍可恢复在库或转入维修。</p>
              <div class="field">
                <label>输入资产编号确认</label>
                <input name="confirm" required placeholder="${escapeAttr(item.assetNo)}" />
              </div>
              <div class="field">
                <label>报废原因</label>
                <textarea name="note" required placeholder="例如损坏不可修复、达到报废年限"></textarea>
              </div>
              <button class="btn danger" type="submit">确认标记报废</button>
            </form>
          </div>
        </section>
      </div>
    `;
  }
  return "";
}

function openTag(input) {
  const value = input.trim();
  const match = value.match(/\/t\/([^/?#]+)/);
  const tag = match ? match[1] : value;
  const item = state.equipment.find((equipment) => equipment.qrTagId === tag || equipment.nfcTagId === tag);
  if (!item) {
    navigate(`/t/${encodeURIComponent(tag)}`);
    return;
  }
  navigate(`/equipment/${item.id}`);
}

async function startScanner() {
  const box = document.querySelector("#scan-video-box");
  if (!box) return;

  if (!("mediaDevices" in navigator) || !("BarcodeDetector" in window)) {
    setScannerMessage("当前浏览器不支持网页扫码，请使用手动输入短码");
    return;
  }

  stopScanner();

  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    scannerStream = stream;
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    box.innerHTML = "";
    box.append(video);
    await video.play();

    scannerTimer = window.setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          stopScanner();
          openTag(codes[0].rawValue);
        }
      } catch {
        stopScanner();
        setScannerMessage("扫码失败，请改用手动输入短码");
      }
    }, 600);
  } catch {
    setScannerMessage("无法访问摄像头，请检查权限或使用手动输入");
  }
}

function stopScanner() {
  if (scannerTimer) {
    clearInterval(scannerTimer);
    scannerTimer = null;
  }
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }
}

function setScannerMessage(message) {
  const box = document.querySelector("#scan-video-box");
  if (box) box.textContent = message;
}

function toast(message) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  window.setTimeout(() => el.remove(), 2600);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
