const TODOS_TABLE = "todos";

const state = {
  todos: [],
  filter: "all",
  sort: "createdAt",
  search: "",
  editingId: null,
};

const form = document.getElementById("todo-form");
const titleInput = document.getElementById("title-input");
const categoryInput = document.getElementById("category-input");
const priorityInput = document.getElementById("priority-input");
const dueDateInput = document.getElementById("due-date-input");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const filterButtons = document.querySelectorAll(".filter-btn");
const listEl = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");

function rowToTodo(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    dueDate: row.due_date,
    completed: row.completed,
    createdAt: row.created_at,
  };
}

async function loadTodos() {
  const { data, error } = await supabaseClient
    .from(TODOS_TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load todos:", error);
    return [];
  }
  return data.map(rowToTodo);
}

async function addTodo({ title, category, priority, dueDate }) {
  const { data, error } = await supabaseClient
    .from(TODOS_TABLE)
    .insert({
      title: title.trim(),
      category: category.trim(),
      priority,
      due_date: dueDate || null,
      completed: false,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to add todo:", error);
    return;
  }
  state.todos.push(rowToTodo(data));
  render();
}

async function updateTodo(id, changes) {
  const payload = {};
  if ("title" in changes) payload.title = changes.title;
  if ("category" in changes) payload.category = changes.category;
  if ("priority" in changes) payload.priority = changes.priority;
  if ("dueDate" in changes) payload.due_date = changes.dueDate;
  if ("completed" in changes) payload.completed = changes.completed;

  const { data, error } = await supabaseClient
    .from(TODOS_TABLE)
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Failed to update todo:", error);
    return;
  }
  const todo = state.todos.find((t) => t.id === id);
  if (todo) Object.assign(todo, rowToTodo(data));
  render();
}

async function deleteTodo(id) {
  const { error } = await supabaseClient.from(TODOS_TABLE).delete().eq("id", id);
  if (error) {
    console.error("Failed to delete todo:", error);
    return;
  }
  state.todos = state.todos.filter((t) => t.id !== id);
  render();
}

async function toggleComplete(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  await updateTodo(id, { completed: !todo.completed });
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: "높음", medium: "중간", low: "낮음" };

function getVisibleTodos() {
  let items = [...state.todos];

  if (state.filter === "active") items = items.filter((t) => !t.completed);
  if (state.filter === "completed") items = items.filter((t) => t.completed);

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    items = items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }

  if (state.sort === "dueDate") {
    items.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  } else if (state.sort === "priority") {
    items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  } else {
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return items;
}

function dueDateStatus(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "due-soon";
  return null;
}

function render() {
  const items = getVisibleTodos();
  listEl.innerHTML = "";
  emptyState.hidden = items.length > 0;

  items.forEach((todo) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.completed ? " completed" : "");

    if (state.editingId === todo.id) {
      li.appendChild(buildEditForm(todo));
      listEl.appendChild(li);
      return;
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;
    checkbox.addEventListener("change", () => toggleComplete(todo.id));

    const body = document.createElement("div");
    body.className = "todo-body";

    const titleEl = document.createElement("div");
    titleEl.className = "todo-title";
    titleEl.textContent = todo.title;

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    if (todo.category) {
      const catBadge = document.createElement("span");
      catBadge.className = "badge";
      catBadge.textContent = todo.category;
      meta.appendChild(catBadge);
    }

    const prBadge = document.createElement("span");
    prBadge.className = `badge priority-${todo.priority}`;
    prBadge.textContent = PRIORITY_LABEL[todo.priority] || todo.priority;
    meta.appendChild(prBadge);

    if (todo.dueDate) {
      const status = dueDateStatus(todo.dueDate);
      const dueBadge = document.createElement("span");
      dueBadge.className = "badge due-date" + (status ? ` ${status}` : "");
      dueBadge.textContent = todo.dueDate + (status === "overdue" ? " (지남)" : "");
      meta.appendChild(dueBadge);
    }

    body.appendChild(titleEl);
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => {
      state.editingId = todo.id;
      render();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn delete";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

function buildEditForm(todo) {
  const wrapper = document.createElement("form");
  wrapper.className = "todo-form";
  wrapper.style.flex = "1";

  const titleEl = document.createElement("input");
  titleEl.type = "text";
  titleEl.value = todo.title;
  titleEl.required = true;

  const categoryEl = document.createElement("input");
  categoryEl.type = "text";
  categoryEl.value = todo.category || "";
  categoryEl.placeholder = "카테고리";

  const priorityEl = document.createElement("select");
  ["high", "medium", "low"].forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = PRIORITY_LABEL[p];
    if (p === todo.priority) opt.selected = true;
    priorityEl.appendChild(opt);
  });

  const dueDateEl = document.createElement("input");
  dueDateEl.type = "date";
  dueDateEl.value = todo.dueDate || "";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.textContent = "저장";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "취소";
  cancelBtn.addEventListener("click", () => {
    state.editingId = null;
    render();
  });

  wrapper.addEventListener("submit", (e) => {
    e.preventDefault();
    updateTodo(todo.id, {
      title: titleEl.value.trim(),
      category: categoryEl.value.trim(),
      priority: priorityEl.value,
      dueDate: dueDateEl.value || null,
    });
    state.editingId = null;
    render();
  });

  wrapper.appendChild(titleEl);
  wrapper.appendChild(categoryEl);
  wrapper.appendChild(priorityEl);
  wrapper.appendChild(dueDateEl);
  wrapper.appendChild(saveBtn);
  wrapper.appendChild(cancelBtn);

  return wrapper;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!titleInput.value.trim()) return;
  addTodo({
    title: titleInput.value,
    category: categoryInput.value,
    priority: priorityInput.value,
    dueDate: dueDateInput.value,
  });
  form.reset();
  priorityInput.value = "medium";
  titleInput.focus();
});

searchInput.addEventListener("input", (e) => {
  state.search = e.target.value;
  render();
});

sortSelect.addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render();
  });
});

(async function init() {
  state.todos = await loadTodos();
  render();
})();
