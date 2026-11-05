import './style.css';

const paymentForm = document.querySelector('#paymentForm');
const amountInput = document.querySelector('#amount');
const submitButton = document.querySelector('#submitButton');
const formError = document.querySelector('#formError');
const receiptContent = document.querySelector('#receiptContent');
const receiptEmpty = document.querySelector('#receiptEmpty');
const downloadButton = document.querySelector('#downloadButton');
const transactions = [];
let activeTransaction = null;
let toastTimer;

const formatMoney = (value) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
}).format(value);

const formatDate = (date, options = {}) => new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  ...options,
}).format(date);

document.querySelector('#currentDate').textContent = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

document.querySelectorAll('[data-amount]').forEach((button) => {
  button.addEventListener('click', () => {
    amountInput.value = button.dataset.amount;
    amountInput.focus();
  });
});

document.querySelectorAll('.method-option input').forEach((input) => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.method-option').forEach((option) => option.classList.remove('selected'));
    input.closest('.method-option').classList.add('selected');
  });
});

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

function setView(view) {
  const isHistory = view === 'history';
  document.querySelector('#paymentView').hidden = isHistory;
  document.querySelector('#historyView').hidden = !isHistory;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  document.querySelector('#breadcrumbCurrent').textContent = isHistory ? 'История' : 'Новая оплата';
  document.querySelector('#pageTitle').innerHTML = isHistory ? 'История операций<span class="title-period">.</span>' : 'Новая оплата<span class="title-period">.</span>';
  document.querySelector('#pageDescription').textContent = isHistory
    ? 'Все успешные платежи текущей сессии.'
    : 'Создайте тестовый платёж и сформируйте чек за пару шагов.';
}

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) {
    showError('Укажите сумму от 1 ₽ до 1 000 000 ₽.');
    amountInput.focus();
    return;
  }

  if (document.querySelector('#simulateDecline').checked) {
    clearReceipt('ОПЕРАЦИЯ ОТКЛОНЕНА');
    showError('Банк отклонил операцию. Деньги не списаны, чек не создан.');
    document.querySelector('#receiptStatus').textContent = 'ОПЕРАЦИЯ ОТКЛОНЕНА';
    document.querySelector('#receiptStatus').classList.add('status-declined');
    showToast('Платёж отклонён в тестовом режиме');
    return;
  }

  setProcessing(true);
  await new Promise((resolve) => window.setTimeout(resolve, 850));
  const transaction = {
    id: `LS-${Date.now().toString().slice(-8)}`,
    amount,
    customer: document.querySelector('#customer').value.trim() || 'Покупатель',
    email: document.querySelector('#email').value.trim(),
    description: document.querySelector('#description').value.trim() || 'Покупка',
    method: new FormData(paymentForm).get('method'),
    date: new Date(),
  };

  transactions.unshift(transaction);
  activeTransaction = transaction;
  renderReceipt(transaction);
  renderHistory();
  setProcessing(false);
  showToast('Оплата прошла успешно. Чек готов к скачиванию.');
});

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
  document.querySelector('#receiptStatus').textContent = 'ТРЕБУЕТСЯ ВНИМАНИЕ';
  document.querySelector('#receiptStatus').classList.add('status-declined');
}

function setProcessing(isProcessing) {
  submitButton.disabled = isProcessing;
  submitButton.classList.toggle('is-processing', isProcessing);
  submitButton.querySelector('.button-label').textContent = isProcessing ? 'Обработка платежа…' : 'Симулировать оплату';
  submitButton.setAttribute('aria-busy', String(isProcessing));
}

function renderReceipt(transaction) {
  receiptEmpty.hidden = true;
  receiptContent.hidden = false;
  document.querySelector('#receiptStatus').textContent = 'ОПЛАЧЕНО';
  document.querySelector('#receiptStatus').classList.remove('status-declined');
  document.querySelector('#receiptNumber').textContent = transaction.id;
  document.querySelector('#receiptDate').textContent = formatDate(transaction.date);
  document.querySelector('#receiptDescription').textContent = transaction.description;
  document.querySelector('#receiptAmount').textContent = formatMoney(transaction.amount);
  document.querySelector('#receiptTotal').textContent = formatMoney(transaction.amount);
  document.querySelector('#receiptMethod').textContent = transaction.method;
  document.querySelector('#receiptCustomer').textContent = transaction.customer;
  downloadButton.disabled = false;
}

function clearReceipt(status) {
  activeTransaction = null;
  receiptContent.hidden = true;
  receiptEmpty.hidden = false;
  downloadButton.disabled = true;
  document.querySelector('#receiptStatus').textContent = status;
  document.querySelector('#receiptStatus').classList.remove('status-declined');
}

function renderHistory() {
  const body = document.querySelector('#historyBody');
  body.replaceChildren();
  document.querySelector('#historyEmpty').hidden = transactions.length > 0;
  document.querySelector('#clearHistory').disabled = transactions.length === 0;
  document.querySelector('#navCount').textContent = transactions.length;

  transactions.forEach((transaction) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><button class="transaction-link" type="button" data-transaction-id="${transaction.id}">${transaction.id}</button></td>
      <td>${escapeHtml(transaction.customer)}</td>
      <td>${escapeHtml(transaction.method)}</td>
      <td>${formatDate(transaction.date)}</td>
      <td class="table-amount">${formatMoney(transaction.amount)}</td>
      <td><span class="table-status"><i></i> Успешно</span></td>
      <td><button class="row-download" type="button" data-transaction-id="${transaction.id}" aria-label="Скачать чек PDF">↓</button></td>`;
    body.append(row);
  });

  body.querySelectorAll('[data-transaction-id]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTransaction = transactions.find((item) => item.id === button.dataset.transactionId);
      renderReceipt(activeTransaction);
      if (button.classList.contains('transaction-link')) setView('payment');
      else downloadReceipt();
    });
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

downloadButton.addEventListener('click', downloadReceipt);

async function downloadReceipt() {
  if (!activeTransaction) return;
  downloadButton.disabled = true;
  downloadButton.classList.add('is-loading');

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(receiptContent, {
      backgroundColor: '#ffffff',
      scale: 3,
      useCORS: true,
      logging: false,
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = canvas.height * imageWidth / canvas.width;
    const top = Math.max(margin, (pageHeight - imageHeight) / 2);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, top, imageWidth, Math.min(imageHeight, pageHeight - margin * 2));
    pdf.save(`chek-${activeTransaction.id}.pdf`);
    showToast('PDF-чек скачан');
  } catch (error) {
    console.error('Не удалось создать PDF-чек', error);
    showToast('Не удалось сформировать PDF. Попробуйте ещё раз.');
  } finally {
    downloadButton.disabled = false;
    downloadButton.classList.remove('is-loading');
  }
}

document.querySelector('#clearHistory').addEventListener('click', () => {
  transactions.splice(0, transactions.length);
  renderHistory();
  clearReceipt('ОЖИДАЕТ ОПЛАТЫ');
  showToast('История операций очищена');
});

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
}