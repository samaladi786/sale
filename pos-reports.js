// ========================================================
// ALNASSR QUICK POS - ACCURATE AS-OF-DATE REPORTING ENGINE
// File: pos-reports.js
// ========================================================

var currentReportMode = 'daily';
var currentReportDataForWA = {};
var currentStatementDataForWA = null;
var rawStatementPartyList = [];

// തീയതി YYYY-MM-DD ഫോർമാറ്റിലേക്ക് കൃത്യമാക്കുന്നു
function parseStandardDate(d) {
  if (!d) return '';
  let s = String(d).split('T')[0].split(' ')[0].trim();
  if (s.includes('/')) {
    let parts = s.split('/');
    if (parts[0].length === 4) return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    else if (parts[2].length === 4) return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  let parts = s.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    else if (parts[2].length === 4) return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  return s;
}

function cleanPartyName(str) {
  if (!str) return '';
  return String(str).split(' (')[0].replace(/^Staff:\s*/i, '').replace(/^\[Loan:\s*/i, '').replace(/\]/g, '').trim().toLowerCase();
}

function formatShortName(name) {
  if (!name) return '';
  let s = String(name).trim();
  return s.length > 17 ? s.substring(0, 16) + '..' : s;
}

// ഡാറ്റ വേരിയബിളുകൾ കൃത്യമായി കണ്ടെത്തുന്നു (Global / Window / LocalStorage Fallback)
function getMasterData() {
  const shopId = window.currentShopId || localStorage.getItem("ALNASSR_SELECTED_SHOP_ID") || "SHOP";
  
  const txns = (window.transactionsList && Array.isArray(window.transactionsList) && window.transactionsList.length > 0)
    ? window.transactionsList
    : (typeof transactionsList !== 'undefined' && Array.isArray(transactionsList) && transactionsList.length > 0 ? transactionsList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_TRANSACTIONS`) || '[]'));

  const custs = (window.customersList && Array.isArray(window.customersList) && window.customersList.length > 0)
    ? window.customersList
    : (typeof customersList !== 'undefined' && Array.isArray(customersList) && customersList.length > 0 ? customersList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_CUSTOMERS`) || '[]'));

  const vends = (window.vendorsList && Array.isArray(window.vendorsList) && window.vendorsList.length > 0)
    ? window.vendorsList
    : (typeof vendorsList !== 'undefined' && Array.isArray(vendorsList) && vendorsList.length > 0 ? vendorsList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_VENDORS`) || '[]'));

  const emps = (window.employeesList && Array.isArray(window.employeesList) && window.employeesList.length > 0)
    ? window.employeesList
    : (typeof employeesList !== 'undefined' && Array.isArray(employeesList) && employeesList.length > 0 ? employeesList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_EMPLOYEES`) || '[]'));

  const exps = (window.expensesMasterList && Array.isArray(window.expensesMasterList) && window.expensesMasterList.length > 0)
    ? window.expensesMasterList
    : (typeof expensesMasterList !== 'undefined' && Array.isArray(expensesMasterList) && expensesMasterList.length > 0 ? expensesMasterList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_EXPENSES_MASTER`) || localStorage.getItem(`ALNASSR_${shopId}_EXPENSES`) || '[]'));

  const loans = (window.loansMasterList && Array.isArray(window.loansMasterList) && window.loansMasterList.length > 0)
    ? window.loansMasterList
    : (typeof loansMasterList !== 'undefined' && Array.isArray(loansMasterList) && loansMasterList.length > 0 ? loansMasterList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_LOANS`) || localStorage.getItem('ALNASSR_CACHE_LOANS') || '[]'));

  const agents = (window.agentsList && Array.isArray(window.agentsList) && window.agentsList.length > 0)
    ? window.agentsList
    : (typeof agentsList !== 'undefined' && Array.isArray(agentsList) && agentsList.length > 0 ? agentsList : JSON.parse(localStorage.getItem(`ALNASSR_${shopId}_AGENTS`) || '[]'));

  const opSettings = (window.openingSettings && (window.openingSettings.openingCash || window.openingSettings.openingBank))
    ? window.openingSettings
    : (typeof openingSettings !== 'undefined' ? openingSettings : { openingCash: 0, openingBank: 0 });

  return { txns, custs, vends, emps, exps, loans, agents, opSettings };
}

function getCustomerAgentName(cust) {
  if (!cust) return '';
  if (cust.agent_name && String(cust.agent_name).trim()) return String(cust.agent_name).trim();
  if (cust.agent && String(cust.agent).trim()) return String(cust.agent).trim();
  const { agents } = getMasterData();
  if (cust.agent_id && Array.isArray(agents)) {
    const matched = agents.find(a => String(a.id) === String(cust.agent_id) || cleanPartyName(a.name) === cleanPartyName(cust.agent_id));
    if (matched && matched.name) return String(matched.name).trim();
  }
  return '';
}

// ========================================================
// 1. REPORTS MODAL CONTROLLER
// ========================================================
function openReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }

  const dashDate = document.getElementById("repFilterDate")?.value || document.getElementById("mobileFilterDate")?.value || document.getElementById("filterDate")?.value || getSaudiBusinessDate();
  if (document.getElementById("repFilterDate")) document.getElementById("repFilterDate").value = dashDate;
  if (document.getElementById("repFilterMonth")) document.getElementById("repFilterMonth").value = dashDate.substring(0, 7);
  if (document.getElementById("statMonth")) document.getElementById("statMonth").value = dashDate.substring(0, 7);

  switchReportMode(currentReportMode || 'daily');
  if (window.lucide) lucide.createIcons();
}

function closeReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

function switchReportMode(mode) {
  currentReportMode = mode;
  const repDailyBtn = document.getElementById("repDailyBtn");
  const repMonthlyBtn = document.getElementById("repMonthlyBtn");
  const repStatBtn = document.getElementById("repStatBtn");
  const statementControlBar = document.getElementById("statementControlBar");
  const statementPrintContainer = document.getElementById("statementPrintContainer");
  const reportPrintContainer = document.getElementById("reportPrintContainer");
  const reportDateSelectorBar = document.getElementById("reportDateSelectorBar");
  const repFilterDate = document.getElementById("repFilterDate");
  const repFilterMonth = document.getElementById("repFilterMonth");
  const repFilterLabel = document.getElementById("repFilterLabel");

  if (repDailyBtn) repDailyBtn.className = "px-2 py-1 rounded-lg text-slate-600 transition cursor-pointer font-bold text-[11px]";
  if (repMonthlyBtn) repMonthlyBtn.className = "px-2 py-1 rounded-lg text-slate-600 transition cursor-pointer font-bold text-[11px]";
  if (repStatBtn) repStatBtn.className = "px-2 py-1 rounded-lg text-slate-600 transition cursor-pointer font-bold text-[11px]";

  if (mode === 'daily') {
    if (repDailyBtn) repDailyBtn.className = "px-2 py-1 rounded-lg bg-emerald-600 text-white shadow transition cursor-pointer font-black text-[11px]";
    if (reportDateSelectorBar) reportDateSelectorBar.classList.remove("hidden");
    if (repFilterDate) repFilterDate.classList.remove("hidden");
    if (repFilterMonth) repFilterMonth.classList.add("hidden");
    if (repFilterLabel) repFilterLabel.innerText = "📅 തീയതി മാറ്റുക:";
    if (statementControlBar) statementControlBar.classList.add("hidden");
    if (statementPrintContainer) statementPrintContainer.classList.add("hidden");
    if (reportPrintContainer) reportPrintContainer.classList.remove("hidden");
    renderReportData('daily');
  } else if (mode === 'monthly') {
    if (repMonthlyBtn) repMonthlyBtn.className = "px-2 py-1 rounded-lg bg-blue-600 text-white shadow transition cursor-pointer font-black text-[11px]";
    if (reportDateSelectorBar) reportDateSelectorBar.classList.remove("hidden");
    if (repFilterDate) repFilterDate.classList.add("hidden");
    if (repFilterMonth) repFilterMonth.classList.remove("hidden");
    if (repFilterLabel) repFilterLabel.innerText = "📅 മാസം മാറ്റുക:";
    if (statementControlBar) statementControlBar.classList.add("hidden");
    if (statementPrintContainer) statementPrintContainer.classList.add("hidden");
    if (reportPrintContainer) reportPrintContainer.classList.remove("hidden");
    renderReportData('monthly');
  } else if (mode === 'statement') {
    if (repStatBtn) repStatBtn.className = "px-2 py-1 rounded-lg bg-indigo-600 text-white shadow transition cursor-pointer font-black text-[11px]";
    if (reportDateSelectorBar) reportDateSelectorBar.classList.add("hidden");
    if (statementControlBar) statementControlBar.classList.remove("hidden");
    if (statementPrintContainer) statementPrintContainer.classList.remove("hidden");
    if (reportPrintContainer) reportPrintContainer.classList.add("hidden");
    populateStatementPartyDatalist();
  }
}

function onReportDateChanged() { renderReportData('daily'); }
function onReportMonthChanged() { renderReportData('monthly'); }

// ========================================================
// 2. REPORT DATA RENDERER (ACCURATE HISTORICAL AS-OF-DATE)
// ========================================================
function renderReportData(mode) {
  const { txns, custs, vends, emps, exps, loans, opSettings } = getMasterData();

  let targetDate = parseStandardDate(document.getElementById("repFilterDate")?.value || document.getElementById("mobileFilterDate")?.value || document.getElementById("filterDate")?.value || getSaudiBusinessDate());
  let targetMonth = (document.getElementById("repFilterMonth")?.value || targetDate.substring(0, 7)).trim();

  let titleText = "";
  let dateBadgeText = "";
  let periodStartDate = "";
  let periodEndDate = "";

  if (mode === 'daily') {
    periodStartDate = targetDate;
    periodEndDate = targetDate;
    titleText = "ഡെയ്‌ലി റിപ്പോർട്ട് (Daily Report)";
    dateBadgeText = `തീയതി: ${targetDate}`;
  } else {
    periodStartDate = `${targetMonth}-01`;
    periodEndDate = `${targetMonth}-31`;
    titleText = `മന്ത്ലി റിപ്പോർട്ട് (${targetMonth})`;
    dateBadgeText = `മാസം: ${targetMonth}`;
  }

  const repModeTitle = document.getElementById("reportModeTitle");
  const repDateBadge = document.getElementById("reportDateBadgeLabel");
  if (repModeTitle) repModeTitle.innerText = titleText;
  if (repDateBadge) repDateBadge.innerText = dateBadgeText;

  let allTx = [...txns];
  if (typeof getOfflineQueue === 'function') {
    const offlineQueue = getOfflineQueue();
    offlineQueue.forEach(item => { 
      const record = item.payload ? item.payload : item;
      allTx.unshift(record); 
    });
  }

  // തീയതികൾ പ്രകാരമുള്ള കൃത്യമായ ഫിൽട്ടർ കണ്ടീഷനുകൾ
  const isBeforePeriod = (d) => parseStandardDate(d) < periodStartDate;
  const isInPeriod = (d) => {
    let std = parseStandardDate(d);
    return std >= periodStartDate && std <= periodEndDate;
  };
  const isUpToCutoff = (d) => parseStandardDate(d) <= periodEndDate;

  // 1. ആ തീയതി വരെയുള്ള ബാലൻസ് കണക്കാക്കുന്ന കൃത്യമായ ഫംഗ്ഷനുകൾ
  function getCustomerAsOfBalance(cust) {
    if (!cust) return 0;
    let bal = parseFloat(cust.opening_balance) || 0;
    let cClean = cleanPartyName(cust.name);
    allTx.forEach(t => {
      if (t && t.type === 'sale' && cleanPartyName(t.party_name) === cClean) {
        if (isUpToCutoff(t.date)) {
          bal += (parseFloat(t.credit_amount) || 0) - (parseFloat(t.cash_amount) || 0) - (parseFloat(t.bank_amount) || 0);
        }
      }
    });
    return Math.round(bal * 100) / 100;
  }

  function getVendorAsOfBalance(vend) {
    if (!vend) return 0;
    let bal = parseFloat(vend.opening_balance) || 0;
    let vClean = cleanPartyName(vend.name);
    allTx.forEach(t => {
      if (t && t.type === 'purchase' && cleanPartyName(t.party_name) === vClean) {
        if (isUpToCutoff(t.date)) {
          bal += (parseFloat(t.credit_amount) || 0) - Math.abs(parseFloat(t.cash_amount) || 0) - Math.abs(parseFloat(t.bank_amount) || 0);
        }
      }
    });
    return Math.round(bal * 100) / 100;
  }

  function getLoanAsOfBalance(loan) {
    if (!loan) return 0;
    let bal = parseFloat(loan.opening_balance) || 0;
    let lClean = cleanPartyName(loan.name);
    allTx.forEach(t => {
      if (t && (t.type === 'loan_in' || t.type === 'loan_out') && cleanPartyName(t.party_name).includes(lClean)) {
        if (isUpToCutoff(t.date)) {
          let amt = Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0);
          if (t.type === 'loan_in') bal += amt;
          else if (t.type === 'loan_out') bal -= amt;
        }
      }
    });
    return Math.round(bal * 100) / 100;
  }

  function getStaffPendingAsOf(emp) {
    if (!emp) return 0;
    let monthlySalary = parseFloat(emp.monthly_salary) || 0;
    let baseAdv = parseFloat(emp.opening_advance || emp.opening_balance) || 0;
    let joinD = parseToDateObj(emp.joining_date || "2026-01-01");
    let targetD = parseToDateObj(periodEndDate);

    if (emp.status === 'stopped' && emp.stop_date) {
      let stopD = parseToDateObj(emp.stop_date);
      if (stopD < targetD) targetD = stopD;
    }

    let accrued = baseAdv;
    if (targetD >= joinD && monthlySalary > 0) {
      let k = 0;
      while (true) {
        let nextCycle = new Date(joinD.getFullYear(), joinD.getMonth() + k + 1, joinD.getDate());
        if (targetD >= nextCycle) k++;
        else break;
      }
      accrued += (k * monthlySalary);
    }

    let empClean = cleanPartyName(emp.name);
    let totalPaid = 0;
    allTx.forEach(t => {
      if (t && t.type === 'salary' && cleanPartyName(t.party_name).includes(empClean)) {
        if (isUpToCutoff(t.date)) {
          totalPaid += (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0));
        }
      }
    });

    return Math.round((accrued - totalPaid) * 100) / 100;
  }

  function getUtilityAsOfBalance(ex) {
    if (!ex) return 0;
    let bal = parseFloat(ex.opening_balance) || 0;
    let exClean = cleanPartyName(ex.name);
    allTx.forEach(t => {
      if (!t) return;
      let tClean = cleanPartyName(t.party_name);
      if (tClean.startsWith(exClean) || tClean === exClean) {
        if (isUpToCutoff(t.date)) {
          if (t.type === 'expense_bill') bal += (parseFloat(t.credit_amount) || 0);
          else if (t.type === 'expense') bal -= (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0));
        }
      }
    });
    return Math.round(bal * 100) / 100;
  }

  // 2. ലിക്വിഡ് ഫണ്ട് കണക്കുകൂട്ടൽ (ആ തീയതി വരെയുള്ളത് മാത്രം)
  let openingLiquidCash = opSettings.openingCash;
  let openingLiquidBank = opSettings.openingBank;
  let closingLiquidCash = opSettings.openingCash;
  let closingLiquidBank = opSettings.openingBank;

  allTx.forEach(t => {
    if (!t) return;
    let tDate = t.date;
    if (isBeforePeriod(tDate)) {
      openingLiquidCash += (parseFloat(t.cash_amount) || 0);
      openingLiquidBank += (parseFloat(t.bank_amount) || 0);
    }
    if (isUpToCutoff(tDate)) {
      closingLiquidCash += (parseFloat(t.cash_amount) || 0);
      closingLiquidBank += (parseFloat(t.bank_amount) || 0);
    }
  });

  // 3. മാപ്പുകൾ തയ്യാറാക്കുന്നു (പഴയ ബാലൻസുള്ള എല്ലാവരെയും തുടക്കത്തിൽ ഉൾപ്പെടുത്തുന്നു)
  let creditSalesMap = {};
  custs.forEach(c => {
    if (c && (c.type || '').toLowerCase() === 'credit') {
      let cleanN = cleanPartyName(c.name);
      creditSalesMap[cleanN] = { name: c.name, clean: cleanN, cash: 0, bank: 0, cr: 0, custObj: c, hasActivity: false };
    }
  });

  let creditPurMap = {};
  vends.forEach(v => {
    if (v && (v.type || '').toLowerCase() === 'credit') {
      let cleanN = cleanPartyName(v.name);
      creditPurMap[cleanN] = { name: v.name, clean: cleanN, cash: 0, bank: 0, cr: 0, vendObj: v, hasActivity: false };
    }
  });

  let salariesMap = {};
  emps.forEach(emp => {
    if (emp && emp.name) {
      let cleanStaff = cleanPartyName(emp.name);
      salariesMap[cleanStaff] = { name: emp.name, clean: cleanStaff, cash: 0, bank: 0, total: 0, empObj: emp, hasActivity: false };
    }
  });

  let expensesMap = {};
  exps.forEach(ex => {
    if (ex && ex.name) {
      let cleanExp = cleanPartyName(ex.name);
      expensesMap[cleanExp] = { name: ex.name, clean: cleanExp, cash: 0, bank: 0, total: 0, expObj: ex, isUtility: true, hasActivity: false };
    }
  });

  let loansMap = {};
  loans.forEach(l => {
    if (l && l.name) {
      let cleanL = cleanPartyName(l.name);
      loansMap[cleanL] = { name: l.name, clean: cleanL, inAmt: 0, outAmt: 0, loanObj: l, hasActivity: false };
    }
  });

  let cashSalesMap = {};
  let cashPurMap = {};

  let totSale = 0, totPur = 0, totExp = 0, totSal = 0;
  let totLoanIn = 0, totLoanOut = 0;
  let custCashReceipt = 0, custBankReceipt = 0;
  let vendCashPay = 0, vendBankPay = 0;

  // 4. ആ കാലയളവിലെ (Period) ട്രാൻസാക്ഷനുകൾ പ്രോസസ്സ് ചെയ്യുന്നു
  allTx.forEach(t => {
    if (!t || !isInPeriod(t.date)) return;

    let cCash = Math.abs(parseFloat(t.cash_amount) || 0);
    let cBank = Math.abs(parseFloat(t.bank_amount) || 0);
    let cCr = parseFloat(t.credit_amount) || 0;
    let rawName = t.party_name || "Unknown";
    let cleanN = cleanPartyName(rawName);

    if (t.type === 'sale') {
      let cust = custs.find(c => c && cleanPartyName(c.name) === cleanN);
      let isCreditCust = cust && (cust.type || '').toLowerCase() === 'credit';

      if (isCreditCust) {
        totSale += cCr;
        custCashReceipt += cCash;
        custBankReceipt += cBank;
        if (!creditSalesMap[cleanN]) {
          creditSalesMap[cleanN] = { name: rawName, clean: cleanN, cash: 0, bank: 0, cr: 0, custObj: cust, hasActivity: true };
        }
        creditSalesMap[cleanN].cash += cCash;
        creditSalesMap[cleanN].bank += cBank;
        creditSalesMap[cleanN].cr += cCr;
        creditSalesMap[cleanN].hasActivity = true;
      } else {
        let lineTotal = cCash + cBank + cCr;
        totSale += lineTotal;
        if (!cashSalesMap[cleanN]) cashSalesMap[cleanN] = { name: rawName, cash: 0, bank: 0, total: 0 };
        cashSalesMap[cleanN].cash += cCash;
        cashSalesMap[cleanN].bank += cBank;
        cashSalesMap[cleanN].total += lineTotal;
      }
    } else if (t.type === 'purchase') {
      let vend = vends.find(v => v && cleanPartyName(v.name) === cleanN);
      let isCreditVend = vend && (vend.type || '').toLowerCase() === 'credit';

      if (isCreditVend) {
        totPur += cCr;
        vendCashPay += cCash;
        vendBankPay += cBank;
        if (!creditPurMap[cleanN]) {
          creditPurMap[cleanN] = { name: rawName, clean: cleanN, cash: 0, bank: 0, cr: 0, vendObj: vend, hasActivity: true };
        }
        creditPurMap[cleanN].cash += cCash;
        creditPurMap[cleanN].bank += cBank;
        creditPurMap[cleanN].cr += cCr;
        creditPurMap[cleanN].hasActivity = true;
      } else {
        let lineTotal = cCash + cBank + cCr;
        totPur += lineTotal;
        if (!cashPurMap[cleanN]) cashPurMap[cleanN] = { name: rawName, cash: 0, bank: 0, total: 0 };
        cashPurMap[cleanN].cash += cCash;
        cashPurMap[cleanN].bank += cBank;
        cashPurMap[cleanN].total += lineTotal;
      }
    } else if (t.type === 'expense') {
      let lineTotal = cCash + cBank;
      totExp += lineTotal;
      let expName = rawName.split(' (')[0].trim();
      let cleanExp = cleanPartyName(expName);

      if (!expensesMap[cleanExp]) {
        let expObj = exps.find(e => cleanPartyName(e.name) === cleanExp);
        expensesMap[cleanExp] = { name: expName, clean: cleanExp, cash: 0, bank: 0, total: 0, expObj: expObj, isUtility: true, hasActivity: true };
      }
      expensesMap[cleanExp].cash += cCash;
      expensesMap[cleanExp].bank += cBank;
      expensesMap[cleanExp].total += lineTotal;
      expensesMap[cleanExp].hasActivity = true;
    } else if (t.type === 'salary') {
      let rawC = parseFloat(t.cash_amount) || 0;
      let rawB = parseFloat(t.bank_amount) || 0;
      if (rawC <= 0 && rawB <= 0) {
        let posC = Math.abs(rawC);
        let posB = Math.abs(rawB);
        let lineTotal = posC + posB;
        totSal += lineTotal;

        let staffName = rawName.replace(/^Staff:\s*/i, "").split(' -')[0].trim();
        let cleanStaff = cleanPartyName(staffName);

        if (!salariesMap[cleanStaff]) {
          let empObj = emps.find(e => cleanPartyName(e.name) === cleanStaff);
          salariesMap[cleanStaff] = { name: staffName, clean: cleanStaff, cash: 0, bank: 0, total: 0, empObj: empObj, hasActivity: true };
        }
        salariesMap[cleanStaff].cash += posC;
        salariesMap[cleanStaff].bank += posB;
        salariesMap[cleanStaff].total += lineTotal;
        salariesMap[cleanStaff].hasActivity = true;
      }
    } else if (t.type === 'loan_in' || t.type === 'loan_out') {
      let amt = cCash + cBank;
      let cleanL = cleanPartyName(rawName);

      if (!loansMap[cleanL]) {
        let loanObj = loans.find(l => cleanPartyName(l.name) === cleanL);
        loansMap[cleanL] = { name: rawName, clean: cleanL, inAmt: 0, outAmt: 0, loanObj: loanObj, hasActivity: true };
      }
      if (t.type === 'loan_in') {
        totLoanIn += amt;
        loansMap[cleanL].inAmt += amt;
      } else {
        totLoanOut += amt;
        loansMap[cleanL].outAmt += amt;
      }
      loansMap[cleanL].hasActivity = true;
    }
  });

  // 5. ടോട്ടൽ സമ്മറികൾ കണക്കാക്കുന്നു
  let totalCustOutstanding = 0;
  custs.forEach(c => { if (c && (c.type || '').toLowerCase() === 'credit') totalCustOutstanding += getCustomerAsOfBalance(c); });

  let totalVendOutstanding = 0;
  vends.forEach(v => { if (v && (v.type || '').toLowerCase() === 'credit') totalVendOutstanding += getVendorAsOfBalance(v); });

  let totalEmpPending = 0;
  emps.forEach(e => { totalEmpPending += getStaffPendingAsOf(e); });

  let totalLoanOutstanding = 0;
  loans.forEach(l => { totalLoanOutstanding += getLoanAsOfBalance(l); });

  let totalOpeningLiquid = openingLiquidCash + openingLiquidBank;
  let totalClosingLiquid = closingLiquidCash + closingLiquidBank;

  const vatOutput = totSale > 0 ? (totSale - (totSale / 1.15)) : 0;
  const vatInput = totPur > 0 ? (totPur - (totPur / 1.15)) : 0;
  const vatNet = vatOutput - vatInput;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  setVal("repOpeningLiquidBal", totalOpeningLiquid.toLocaleString('en-IN'));
  setVal("repTotalSale", totSale.toLocaleString('en-IN'));
  setVal("repTotalPurchase", totPur.toLocaleString('en-IN'));
  setVal("repTotalExpense", (totExp + totSal).toLocaleString('en-IN'));
  setVal("repCustBal", totalCustOutstanding.toLocaleString('en-IN'));
  setVal("repVendorBal", totalVendOutstanding.toLocaleString('en-IN'));
  setVal("repSalaryBal", totalEmpPending.toLocaleString('en-IN'));
  if (document.getElementById("repLoanBal")) setVal("repLoanBal", totalLoanOutstanding.toLocaleString('en-IN'));
  setVal("repLiquidBal", totalClosingLiquid.toLocaleString('en-IN'));

  setVal("vatOutputText", `${vatOutput.toFixed(2)} SR`);
  setVal("vatInputText", `${vatInput.toFixed(2)} SR`);
  setVal("vatNetPayableText", `${vatNet.toFixed(2)} SR`);

  setVal("salesGrandBadge", `ആകെ: ${totSale.toLocaleString('en-IN')}`);
  setVal("purchaseGrandBadge", `ആകെ: ${totPur.toLocaleString('en-IN')}`);

  // 6. ടേബിളുകൾ നിർമ്മിക്കുന്നു

  // A. CASH SALES TABLE
  const cashSalesArr = Object.values(cashSalesMap);
  let rCSCash = 0, rCSBank = 0, rCSTotal = 0;
  let cashSalesHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-emerald-100 text-slate-900 font-black border-b text-[10px]"><th class="p-1 text-left">പേര്</th><th class="p-1">ക്യാഷ്</th><th class="p-1">ബാങ്ക്</th><th class="p-1 text-right">ആകെ</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10.5px]">`;
  if (cashSalesArr.length === 0) cashSalesHtml += `<tr><td colspan="4" class="p-1 text-center text-slate-400">ഇടപാടുകൾ ഇല്ല</td></tr>`;
  else {
    cashSalesArr.forEach(s => {
      rCSCash += s.cash; rCSBank += s.bank; rCSTotal += s.total;
      cashSalesHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${s.name}">${formatShortName(s.name)}</td><td class="p-1 text-emerald-800">${s.cash}</td><td class="p-1 text-blue-800">${s.bank}</td><td class="p-1 text-right font-black text-slate-950">${s.total}</td></tr>`;
    });
  }
  cashSalesHtml += `</tbody><tfoot><tr class="bg-emerald-50 text-emerald-950 font-black border-t text-[10.5px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1">${rCSCash}</td><td class="p-1">${rCSBank}</td><td class="p-1 text-right text-slate-950">${rCSTotal}</td></tr></tfoot></table>`;
  const repCS = document.getElementById("repCashSalesList");
  if (repCS) repCS.innerHTML = cashSalesHtml;

  // B. CREDIT SALES TABLE (ആ തീയതി വരെയുള്ള ബാക്കി ഉൾപ്പെടെയുള്ള 5 കോളങ്ങൾ)
  let creditSalesArr = Object.values(creditSalesMap).map(s => {
    s.closingDue = getCustomerAsOfBalance(s.custObj || { name: s.name, opening_balance: 0 });
    return s;
  }).filter(s => s.hasActivity || Math.abs(s.closingDue) > 0.01);
  creditSalesArr.sort((a, b) => b.closingDue - a.closingDue);

  let rCrSCash = 0, rCrSBank = 0, rCrSCr = 0, rCrSTotDue = 0;
  let creditSalesHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-amber-100 text-slate-900 font-black border-b text-[10px]"><th class="p-1 text-left">പേര്</th><th class="p-1">ക്യാഷ്</th><th class="p-1">ബാങ്ക്</th><th class="p-1">ക്രെഡിറ്റ്</th><th class="p-1 text-right bg-amber-200/80">തരാനുള്ള ബാക്കി</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
  if (creditSalesArr.length === 0) creditSalesHtml += `<tr><td colspan="5" class="p-1 text-center text-slate-400">ഇടപാടുകൾ / കുടിശ്ശികകൾ ഇല്ല</td></tr>`;
  else {
    creditSalesArr.forEach(s => {
      rCrSCash += s.cash; rCrSBank += s.bank; rCrSCr += s.cr; rCrSTotDue += s.closingDue;
      creditSalesHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${s.name}">${formatShortName(s.name)}</td><td class="p-1 text-emerald-800">${s.cash > 0 ? s.cash : '-'}</td><td class="p-1 text-blue-800">${s.bank > 0 ? s.bank : '-'}</td><td class="p-1 font-black text-amber-900">${s.cr > 0 ? s.cr : '-'}</td><td class="p-1 text-right font-black text-rose-800">${s.closingDue.toLocaleString('en-IN')}</td></tr>`;
    });
  }
  creditSalesHtml += `</tbody><tfoot><tr class="bg-amber-50 text-amber-950 font-black border-t text-[10px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1">${rCrSCash}</td><td class="p-1">${rCrSBank}</td><td class="p-1">${rCrSCr}</td><td class="p-1 text-right text-rose-900 font-black">${rCrSTotDue.toLocaleString('en-IN')}</td></tr></tfoot></table>`;
  const repCrS = document.getElementById("repCreditSalesList");
  if (repCrS) repCrS.innerHTML = creditSalesHtml;

  // C. CASH PURCHASES TABLE
  const cashPurArr = Object.values(cashPurMap);
  let rCPCash = 0, rCPBank = 0, rCPTotal = 0;
  let cashPurHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-blue-100 text-slate-900 font-black border-b text-[10px]"><th class="p-1 text-left">വെണ്ടർ</th><th class="p-1">ക്യാഷ്</th><th class="p-1">ബാങ്ക്</th><th class="p-1 text-right">ആകെ</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10.5px]">`;
  if (cashPurArr.length === 0) cashPurHtml += `<tr><td colspan="4" class="p-1 text-center text-slate-400">ഇടപാടുകൾ ഇല്ല</td></tr>`;
  else {
    cashPurArr.forEach(p => {
      rCPCash += p.cash; rCPBank += p.bank; rCPTotal += p.total;
      cashPurHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${p.name}">${formatShortName(p.name)}</td><td class="p-1 text-blue-800">${p.cash}</td><td class="p-1 text-indigo-800">${p.bank}</td><td class="p-1 text-right font-black text-slate-950">${p.total}</td></tr>`;
    });
  }
  cashPurHtml += `</tbody><tfoot><tr class="bg-blue-50 text-blue-950 font-black border-t text-[10.5px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1">${rCPCash}</td><td class="p-1">${rCPBank}</td><td class="p-1 text-right text-slate-950">${rCPTotal}</td></tr></tfoot></table>`;
  const repCP = document.getElementById("repCashPurchasesList");
  if (repCP) repCP.innerHTML = cashPurHtml;

  // D. CREDIT PURCHASES TABLE (ആ തീയതി വരെയുള്ള ബാക്കി ഉൾപ്പെടെയുള്ള 5 കോളങ്ങൾ)
  let creditPurArr = Object.values(creditPurMap).map(p => {
    p.closingDue = getVendorAsOfBalance(p.vendObj || { name: p.name, opening_balance: 0 });
    return p;
  }).filter(p => p.hasActivity || Math.abs(p.closingDue) > 0.01);
  creditPurArr.sort((a, b) => b.closingDue - a.closingDue);

  let rCrPCash = 0, rCrPBank = 0, rCrPCr = 0, rCrPTotPayable = 0;
  let creditPurHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-indigo-100 text-slate-900 font-black border-b text-[10px]"><th class="p-1 text-left">വെണ്ടർ</th><th class="p-1">ക്യാഷ്</th><th class="p-1">ബാങ്ക്</th><th class="p-1">ക്രെഡിറ്റ്</th><th class="p-1 text-right bg-indigo-200/80">കൊടുക്കാനുള്ള ബാക്കി</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
  if (creditPurArr.length === 0) creditPurHtml += `<tr><td colspan="5" class="p-1 text-center text-slate-400">ഇടപാടുകൾ / ബാധ്യതകൾ ഇല്ല</td></tr>`;
  else {
    creditPurArr.forEach(p => {
      rCrPCash += p.cash; rCrPBank += p.bank; rCrPCr += p.cr; rCrPTotPayable += p.closingDue;
      creditPurHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${p.name}">${formatShortName(p.name)}</td><td class="p-1 text-blue-800">${p.cash > 0 ? p.cash : '-'}</td><td class="p-1 text-indigo-800">${p.bank > 0 ? p.bank : '-'}</td><td class="p-1 font-black text-indigo-950">${p.cr > 0 ? p.cr : '-'}</td><td class="p-1 text-right font-black text-rose-800">${p.closingDue.toLocaleString('en-IN')}</td></tr>`;
    });
  }
  creditPurHtml += `</tbody><tfoot><tr class="bg-indigo-50 text-indigo-950 font-black border-t text-[10px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1">${rCrPCash}</td><td class="p-1">${rCrPBank}</td><td class="p-1">${rCrPCr}</td><td class="p-1 text-right text-rose-900 font-black">${rCrPTotPayable.toLocaleString('en-IN')}</td></tr></tfoot></table>`;
  const repCrP = document.getElementById("repCreditPurchasesList");
  if (repCrP) repCrP.innerHTML = creditPurHtml;

  // E. SALARIES TABLE (ആ തീയതി വരെയുള്ള സാലറി ബാക്കി ഉൾപ്പെടെയുള്ള 5 കോളങ്ങൾ)
  let salArr = Object.values(salariesMap).map(s => {
    s.pendingDue = getStaffPendingAsOf(s.empObj || { name: s.name });
    return s;
  }).filter(s => s.hasActivity || Math.abs(s.pendingDue) > 0.01);
  salArr.sort((a, b) => b.pendingDue - a.pendingDue);

  let rSalCash = 0, rSalBank = 0, rSalTotal = 0, rSalTotPending = 0;
  let salHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-purple-100 text-slate-900 font-black border-b text-[10px]"><th class="p-1 text-left">സ്റ്റാഫ്</th><th class="p-1">ക്യാഷ്</th><th class="p-1">ബാങ്ക്</th><th class="p-1">ആകെ</th><th class="p-1 text-right bg-purple-200/80">സാലറി ബാക്കി</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
  if (salArr.length === 0) salHtml += `<tr><td colspan="5" class="p-1 text-center text-slate-400">സാലറി ഇടപാടുകൾ / കുടിശ്ശിക ഇല്ല</td></tr>`;
  else {
    salArr.forEach(s => {
      rSalCash += s.cash; rSalBank += s.bank; rSalTotal += s.total; rSalTotPending += s.pendingDue;
      salHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${s.name}">${formatShortName(s.name)}</td><td class="p-1 text-purple-800">${s.cash > 0 ? s.cash : '-'}</td><td class="p-1 text-blue-800">${s.bank > 0 ? s.bank : '-'}</td><td class="p-1 font-black text-purple-950">${s.total > 0 ? s.total : '-'}</td><td class="p-1 text-right font-black text-purple-900">${s.pendingDue.toLocaleString('en-IN')}</td></tr>`;
    });
  }
  salHtml += `</tbody><tfoot><tr class="bg-purple-50 text-purple-950 font-black border-t text-[10px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1">${rSalCash}</td><td class="p-1">${rSalBank}</td><td class="p-1 text-purple-950">${rSalTotal}</td><td class="p-1 text-right font-black text-purple-900">${rSalTotPending.toLocaleString('en-IN')}</td></tr></tfoot></table>`;
  const repSal = document.getElementById("repSalariesList");
  if (repSal) repSal.innerHTML = salHtml;

  // F. EXPENSES TABLE (ആ തീയതി വരെയുള്ള ബില്ല് ബാക്കി ഉൾപ്പെടെയുള്ള 5 കോളങ്ങൾ)
  let expArr = Object.values(expensesMap).map(e => {
    e.balDue = getUtilityAsOfBalance(e.expObj || { name: e.name });
    return e;
  }).filter(e => e.hasActivity || Math.abs(e.balDue) > 0.01);
  expArr.sort((a, b) => b.balDue - a.balDue);

  let rExpCash = 0, rExpBank = 0, rExpTotal = 0, rExpTotDue = 0;
  let expHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-amber-100 text-slate-900 font-black border-b text-[10px]"><th class="p-1 text-left">ഇനം</th><th class="p-1">ക്യാഷ്</th><th class="p-1">ബാങ്ക്</th><th class="p-1">ആകെ</th><th class="p-1 text-right bg-amber-200/80">ബില്ല് ബാക്കി</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
  if (expArr.length === 0) expHtml += `<tr><td colspan="5" class="p-1 text-center text-slate-400">ചിലവുകൾ ഇല്ല</td></tr>`;
  else {
    expArr.forEach(e => {
      rExpCash += e.cash; rExpBank += e.bank; rExpTotal += e.total; rExpTotDue += e.balDue;
      expHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${e.name}">${formatShortName(e.name)}</td><td class="p-1 text-amber-800">${e.cash > 0 ? e.cash : '-'}</td><td class="p-1 text-blue-800">${e.bank > 0 ? e.bank : '-'}</td><td class="p-1 font-black text-slate-950">${e.total > 0 ? e.total : '-'}</td><td class="p-1 text-right font-black ${e.balDue > 0 ? 'text-rose-700' : 'text-slate-400'}">${e.balDue > 0 ? e.balDue.toLocaleString('en-IN') : '-'}</td></tr>`;
    });
  }
  expHtml += `</tbody><tfoot><tr class="bg-amber-50 text-amber-950 font-black border-t text-[10px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1">${rExpCash}</td><td class="p-1">${rExpBank}</td><td class="p-1 text-slate-950">${rExpTotal}</td><td class="p-1 text-right font-black text-amber-900">${rExpTotDue.toLocaleString('en-IN')}</td></tr></tfoot></table>`;
  const repExp = document.getElementById("repExpensesList");
  if (repExp) repExp.innerHTML = expHtml;

  // G. LOANS TABLE (ആ തീയതി വരെയുള്ള ലോൺ ബാക്കി സഹിതം)
  let loansArr = Object.values(loansMap).map(l => {
    l.balDue = getLoanAsOfBalance(l.loanObj || { name: l.name, opening_balance: 0 });
    return l;
  }).filter(l => l.hasActivity || Math.abs(l.balDue) > 0.01);
  loansArr.sort((a, b) => b.balDue - a.balDue);

  let rLoanIn = 0, rLoanOut = 0, rLoanTotBal = 0;
  let loansHtml = `<table class="w-full text-center border-collapse"><thead><tr class="bg-purple-100 text-purple-950 font-black border-b text-[10px]"><th class="p-1 text-left">ലോൺ പാർട്ടി (Lender)</th><th class="p-1">വാങ്ങിയത് (+)</th><th class="p-1">തിരിച്ചടവ് (-)</th><th class="p-1 text-right bg-purple-200/80">കൊടുക്കാനുള്ള ബാക്കി</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
  if (loansArr.length === 0) {
    loansHtml += `<tr><td colspan="4" class="p-1.5 text-center text-slate-400">ലോൺ ബാധ്യതകൾ ഇല്ല</td></tr>`;
  } else {
    loansArr.forEach(l => {
      rLoanIn += l.inAmt; rLoanOut += l.outAmt; rLoanTotBal += l.balDue;
      loansHtml += `<tr><td class="p-1 text-left font-black text-slate-900 truncate" title="${l.name}">${formatShortName(l.name)}</td><td class="p-1 text-emerald-800">${l.inAmt > 0 ? '+' + l.inAmt.toLocaleString('en-IN') : '-'}</td><td class="p-1 text-rose-800">${l.outAmt > 0 ? '-' + l.outAmt.toLocaleString('en-IN') : '-'}</td><td class="p-1 text-right font-black text-purple-900">${l.balDue.toLocaleString('en-IN')}</td></tr>`;
    });
  }
  loansHtml += `</tbody><tfoot><tr class="bg-purple-50 text-purple-950 font-black border-t text-[10px]"><td class="p-1 text-left uppercase">ആകെ:</td><td class="p-1 text-emerald-800">${rLoanIn > 0 ? '+' + rLoanIn.toLocaleString('en-IN') : '-'}</td><td class="p-1 text-rose-800">${rLoanOut > 0 ? '-' + rLoanOut.toLocaleString('en-IN') : '-'}</td><td class="p-1 text-right text-purple-900 font-black">${rLoanTotBal.toLocaleString('en-IN')}</td></tr></tfoot></table>`;
  
  const repLoans = document.getElementById("repLoansList");
  if (repLoans) {
    repLoans.innerHTML = loansHtml;
  } else if (repExp) {
    repExp.innerHTML = expHtml + `
      <div class="mt-2 pt-1.5 border-t-2 border-purple-200">
        <h4 class="font-extrabold text-purple-950 text-[10.5px] mb-1 flex justify-between">
          <span>🤝 ലോൺ ബാധ്യതകൾ (Loans Ledger)</span>
          <span class="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-black">ആകെ ബാക്കി: ${totalLoanOutstanding.toLocaleString('en-IN')}</span>
        </h4>
        ${loansHtml}
      </div>
    `;
  }

  currentReportDataForWA = {
    shopName: (window.currentShop && window.currentShop.name) ? window.currentShop.name : "ALNASSR",
    title: titleText,
    dateLabel: dateBadgeText,
    sale: totSale.toLocaleString('en-IN'),
    purchase: totPur.toLocaleString('en-IN'),
    expense: (totExp + totSal).toLocaleString('en-IN'),
    loanIn: totLoanIn.toLocaleString('en-IN'),
    loanOut: totLoanOut.toLocaleString('en-IN'),
    loanBal: totalLoanOutstanding.toLocaleString('en-IN'),
    vatOutput: vatOutput.toFixed(2),
    vatInput: vatInput.toFixed(2),
    vatNet: vatNet.toFixed(2),
    cash: closingLiquidCash.toLocaleString('en-IN'),
    bank: closingLiquidBank.toLocaleString('en-IN'),
    custPaid: (custCashReceipt + custBankReceipt).toLocaleString('en-IN'),
    custBal: totalCustOutstanding.toLocaleString('en-IN'),
    vendorPaid: (vendCashPay + vendBankPay).toLocaleString('en-IN'),
    vendorBal: totalVendOutstanding.toLocaleString('en-IN'),
    empBal: totalEmpPending.toLocaleString('en-IN')
  };
}

// ========================================================
// 3. STATEMENTS ENGINE (FULL HISTORICAL ACCURACY)
// ========================================================
function populateStatementPartyDatalist() {
  const { custs, vends, emps, exps, loans, agents } = getMasterData();
  const type = document.getElementById("statPartyType")?.value || 'customer';
  const searchInp = document.getElementById("statPartySearch");
  if (searchInp) searchInp.value = "";
  rawStatementPartyList = [];

  if (type === 'customer') {
    rawStatementPartyList.push({ val: "ALL CUSTOMERS", label: "📋 ALL CUSTOMERS (ആകെ ക്രെഡിറ്റ് കസ്റ്റമർമാർ)" });
    custs.filter(c => c && (c.type || '').toLowerCase() === 'credit').forEach(c => {
      rawStatementPartyList.push({ val: c.name.toUpperCase(), label: c.name.toUpperCase() });
    });
  } else if (type === 'vendor') {
    rawStatementPartyList.push({ val: "ALL VENDORS", label: "📋 ALL VENDORS (ആകെ വെണ്ടർമാർ)" });
    vends.forEach(v => {
      rawStatementPartyList.push({ val: v.name.toUpperCase(), label: v.name.toUpperCase() });
    });
  } else if (type === 'employee') {
    rawStatementPartyList.push({ val: "ALL EMPLOYEES", label: "📋 ALL EMPLOYEES (ആകെ സ്റ്റാഫ്)" });
    emps.forEach(em => {
      let label = em.status === 'stopped' ? `${em.name.toUpperCase()} (Stopped)` : em.name.toUpperCase();
      rawStatementPartyList.push({ val: label, label: `👥 ${label}` });
    });
  } else if (type === 'agent') {
    rawStatementPartyList.push({ val: "ALL AGENTS", label: "📋 ALL AGENTS (ആകെ റൂട്ട് ഏജന്റുമാർ)" });
    let allAgentNames = new Set();
    agents.forEach(a => { if (a && a.name) allAgentNames.add(a.name.trim().toUpperCase()); });
    custs.forEach(c => { 
      const ag = getCustomerAgentName(c);
      if (ag) allAgentNames.add(ag.toUpperCase()); 
    });
    allAgentNames.forEach(ag => {
      rawStatementPartyList.push({ val: ag, label: `👤 ${ag}` });
    });
  } else if (type === 'expense') {
    rawStatementPartyList.push({ val: "ALL UTILITY BILLS", label: "📋 ALL UTILITY BILLS (ആകെ ബില്ലുകൾ)" });
    exps.forEach(ex => {
      rawStatementPartyList.push({ val: ex.name.toUpperCase(), label: `⚡ ${ex.name.toUpperCase()}` });
    });
  } else if (type === 'loan') {
    rawStatementPartyList.push({ val: "ALL LOANS", label: "📋 ALL LOANS (ആകെ ലോൺ / കടം നൽകിയവർ)" });
    loans.forEach(l => {
      rawStatementPartyList.push({ val: l.name.toUpperCase(), label: `🤝 ${l.name.toUpperCase()}` });
    });
  }

  // മൊബൈൽ ഡ്രോപ്പ്ഡൗണും ഡെസ്ക്ടോപ്പ് ഡാറ്റാലിസ്റ്റും ഒരുപോലെ അപ്‌ഡേറ്റ് ചെയ്യുന്നു
  renderStatementSelectOptions(rawStatementPartyList);
  generateStatement();
}

function renderStatementSelectOptions(list) {
  const sel = document.getElementById("statPartySelect");
  const dl = document.getElementById("statPartyDatalist");
  const inp = document.getElementById("statPartyInput");

  if (sel) {
    sel.innerHTML = "";
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.val;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });
  }

  if (dl) {
    dl.innerHTML = "";
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.val;
      dl.appendChild(opt);
    });
  }

  if (inp && (!inp.value || !list.some(i => i.val === inp.value))) {
    if (list.length > 0) inp.value = list[0].val;
  }
}

function filterStatementParties(query) {
  const q = (query || "").trim().toUpperCase();
  const filtered = rawStatementPartyList.filter(item => {
    return item.val.includes(q) || item.label.toUpperCase().includes(q);
  });
  renderStatementSelectOptions(filtered.length > 0 ? filtered : rawStatementPartyList);
  generateStatement();
}

function generateStatement() {
  const { txns, custs, vends, emps, exps, loans, agents } = getMasterData();
  const type = document.getElementById("statPartyType")?.value || 'customer';
  const sel = document.getElementById("statPartySelect");
  const inp = document.getElementById("statPartyInput");

  let partyVal = ((sel && sel.value) ? sel.value : (inp ? inp.value : "")).trim().toUpperCase();
  let monthVal = (document.getElementById("statMonth")?.value || "").trim();

  if (!monthVal) {
    monthVal = (document.getElementById("mobileFilterDate")?.value || document.getElementById("filterDate")?.value || getSaudiBusinessDate()).substring(0, 7);
    if (document.getElementById("statMonth")) document.getElementById("statMonth").value = monthVal;
  }

  if (!partyVal) {
    if (type === 'customer') partyVal = "ALL CUSTOMERS";
    else if (type === 'vendor') partyVal = "ALL VENDORS";
    else if (type === 'agent') partyVal = "ALL AGENTS";
    else if (type === 'employee') partyVal = "ALL EMPLOYEES";
    else if (type === 'expense') partyVal = "ALL UTILITY BILLS";
    else if (type === 'loan') partyVal = "ALL LOANS";
    if (sel) sel.value = partyVal;
    if (inp) inp.value = partyVal;
  }

  const fromDate = `${monthVal}-01`;
  const toDate = `${monthVal}-31`;

  let allTx = [...txns];
  if (typeof getOfflineQueue === 'function') {
    const offlineQueue = getOfflineQueue();
    offlineQueue.forEach(item => { 
      const record = item.payload ? item.payload : item;
      allTx.unshift(record); 
    });
  }
  allTx.sort((a, b) => (parseStandardDate(a.date) || '').localeCompare(parseStandardDate(b.date) || ''));

  let partyName = partyVal;
  let openingBal = 0;
  let runningBal = 0;
  let totalSalesOrBills = 0;
  let totalPaidOrCollected = 0;
  let statementRows = [];

  let isAllVendorsMode = (type === 'vendor' && (partyVal === 'ALL VENDORS' || partyVal === 'ALL'));
  let isAllCustomersMode = (type === 'customer' && (partyVal === 'ALL CUSTOMERS' || partyVal === 'ALL'));
  let isAllEmployeesMode = (type === 'employee' && (partyVal === 'ALL EMPLOYEES' || partyVal === 'ALL'));
  let isAllAgentsMode = (type === 'agent' && (partyVal === 'ALL AGENTS' || partyVal === 'ALL'));
  let isAllUtilityBillsMode = (type === 'expense' && (partyVal === 'ALL UTILITY BILLS' || partyVal === 'ALL'));
  let isAllLoansMode = (type === 'loan' && (partyVal === 'ALL LOANS' || partyVal === 'ALL'));

  let vendorsConsolidatedSummary = [];
  let customersConsolidatedSummary = [];
  let employeesConsolidatedSummary = [];
  let agentsConsolidatedSummary = [];
  let singleAgentCustomersSummary = [];
  let utilitiesConsolidatedSummary = [];
  let loansConsolidatedSummary = [];

  // 1. CUSTOMERS STATEMENT
  if (type === 'customer' && !isAllCustomersMode) {
    const custClean = cleanPartyName(partyVal);
    const cust = custs.find(c => c && cleanPartyName(c.name) === custClean);
    partyName = cust ? cust.name.toUpperCase() : partyVal;
    openingBal = parseFloat(cust?.opening_balance) || 0;

    allTx.forEach(t => {
      let tDate = parseStandardDate(t.date);
      if (t && cleanPartyName(t.party_name) === custClean && t.type === 'sale') {
        const debit = parseFloat(t.credit_amount) || 0;
        const credit = (parseFloat(t.cash_amount) || 0) + (parseFloat(t.bank_amount) || 0);

        if (tDate < fromDate) {
          openingBal += (debit - credit);
        } else if (tDate >= fromDate && tDate <= toDate) {
          totalSalesOrBills += debit;
          totalPaidOrCollected += credit;
          statementRows.push({
            date: tDate,
            desc: debit > 0 ? (credit > 0 ? 'Sale Bill & Collection' : 'Credit Sale Bill') : 'Collection Receipt',
            cash: credit,
            bank: 0,
            bill: debit
          });
        }
      }
    });

    runningBal = openingBal;
    statementRows.forEach(r => {
      runningBal += (r.bill - r.cash);
      r.bal = runningBal;
    });
  } else if (isAllCustomersMode) {
    partyName = `TOTAL CREDIT CUSTOMERS STATEMENT (${monthVal})`;
    custs.filter(c => c && (c.type || '').toLowerCase() === 'credit').forEach(cust => {
      let cOpening = parseFloat(cust.opening_balance) || 0;
      let cSales = 0, cPaid = 0;
      let cClean = cleanPartyName(cust.name);

      allTx.forEach(t => {
        if (t && cleanPartyName(t.party_name) === cClean && t.type === 'sale') {
          let tDate = parseStandardDate(t.date);
          let cr = parseFloat(t.credit_amount) || 0;
          let paid = (parseFloat(t.cash_amount) || 0) + (parseFloat(t.bank_amount) || 0);
          if (tDate < fromDate) cOpening += (cr - paid);
          else if (tDate >= fromDate && tDate <= toDate) { cSales += cr; cPaid += paid; }
        }
      });

      let cClose = cOpening + cSales - cPaid;
      if (cSales > 0 || cPaid > 0 || Math.abs(cClose) > 0.01) {
        customersConsolidatedSummary.push({ name: cust.name, opening: cOpening, sales: cSales, paid: cPaid, closing: cClose });
        openingBal += cOpening; totalSalesOrBills += cSales; totalPaidOrCollected += cPaid; runningBal += cClose;
      }
    });
    customersConsolidatedSummary.sort((a, b) => b.closing - a.closing);
  }

  // 2. VENDORS STATEMENT
  else if (type === 'vendor' && !isAllVendorsMode) {
    const vendClean = cleanPartyName(partyVal);
    const vend = vends.find(v => v && cleanPartyName(v.name) === vendClean);
    partyName = vend ? vend.name.toUpperCase() : partyVal;
    openingBal = parseFloat(vend?.opening_balance) || 0;

    allTx.forEach(t => {
      let tDate = parseStandardDate(t.date);
      if (t && cleanPartyName(t.party_name) === vendClean && t.type === 'purchase') {
        const debit = parseFloat(t.credit_amount) || 0;
        const paid = Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0);

        if (tDate < fromDate) {
          openingBal += (debit - paid);
        } else if (tDate >= fromDate && tDate <= toDate) {
          totalSalesOrBills += debit;
          totalPaidOrCollected += paid;
          statementRows.push({
            date: tDate,
            desc: debit > 0 ? (paid > 0 ? 'Purchase & Payment' : 'Credit Purchase Bill') : 'Vendor Payment Disbursed',
            cash: paid,
            bank: 0,
            bill: debit
          });
        }
      }
    });

    runningBal = openingBal;
    statementRows.forEach(r => {
      runningBal += (r.bill - r.cash);
      r.bal = runningBal;
    });
  } else if (isAllVendorsMode) {
    partyName = `TOTAL VENDORS STATEMENT (${monthVal})`;
    vends.filter(v => v && (v.type === 'credit' || !v.type)).forEach(vend => {
      let vOpening = parseFloat(vend.opening_balance) || 0;
      let vPur = 0, vPaid = 0;
      let vClean = cleanPartyName(vend.name);

      allTx.forEach(t => {
        if (t && cleanPartyName(t.party_name) === vClean && t.type === 'purchase') {
          let tDate = parseStandardDate(t.date);
          let cr = parseFloat(t.credit_amount) || 0;
          let paid = Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0);
          if (tDate < fromDate) vOpening += (cr - paid);
          else if (tDate >= fromDate && tDate <= toDate) { vPur += cr; vPaid += paid; }
        }
      });

      let vClose = vOpening + vPur - vPaid;
      if (vPur > 0 || vPaid > 0 || Math.abs(vClose) > 0.01) {
        vendorsConsolidatedSummary.push({ name: vend.name, opening: vOpening, purchases: vPur, paid: vPaid, closing: vClose });
        openingBal += vOpening; totalSalesOrBills += vPur; totalPaidOrCollected += vPaid; runningBal += vClose;
      }
    });
    vendorsConsolidatedSummary.sort((a, b) => b.closing - a.closing);
  }

  // 3. LOANS STATEMENT
  else if (type === 'loan') {
    if (isAllLoansMode) {
      partyName = `TOTAL LOANS & LIABILITIES STATEMENT (${monthVal})`;
      loans.forEach(loan => {
        let lOpen = parseFloat(loan.opening_balance) || 0;
        let lIn = 0, lOut = 0;
        let lClean = cleanPartyName(loan.name);

        allTx.forEach(t => {
          if (t && (t.type === 'loan_in' || t.type === 'loan_out') && cleanPartyName(t.party_name).includes(lClean)) {
            let tDate = parseStandardDate(t.date);
            let amt = Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0);
            if (tDate < fromDate) {
              if (t.type === 'loan_in') lOpen += amt;
              else lOpen -= amt;
            } else if (tDate >= fromDate && tDate <= toDate) {
              if (t.type === 'loan_in') lIn += amt;
              else lOut += amt;
            }
          }
        });

        let lClose = lOpen + lIn - lOut;
        if (lIn > 0 || lOut > 0 || Math.abs(lClose) > 0.01) {
          loansConsolidatedSummary.push({ name: loan.name, opening: lOpen, borrowed: lIn, repaid: lOut, closing: lClose });
          openingBal += lOpen; totalSalesOrBills += lIn; totalPaidOrCollected += lOut; runningBal += lClose;
        }
      });
      loansConsolidatedSummary.sort((a, b) => b.closing - a.closing);
    } else {
      const loanClean = cleanPartyName(partyVal);
      const loanItem = loans.find(l => l && cleanPartyName(l.name) === loanClean);
      partyName = loanItem ? `LOAN: ${loanItem.name.toUpperCase()}` : `LOAN: ${partyVal}`;
      openingBal = parseFloat(loanItem?.opening_balance) || 0;

      allTx.forEach(t => {
        if (t && (t.type === 'loan_in' || t.type === 'loan_out') && cleanPartyName(t.party_name).includes(loanClean)) {
          let tDate = parseStandardDate(t.date);
          let amt = Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0);
          if (tDate < fromDate) {
            if (t.type === 'loan_in') openingBal += amt;
            else openingBal -= amt;
          } else if (tDate >= fromDate && tDate <= toDate) {
            if (t.type === 'loan_in') {
              totalSalesOrBills += amt;
              statementRows.push({ date: tDate, desc: t.party_name || "കടം വാങ്ങിയത് (+Cash)", cash: 0, bank: 0, bill: amt, isLoanIn: true });
            } else {
              totalPaidOrCollected += amt;
              statementRows.push({ date: tDate, desc: t.party_name || "തിരിച്ചടച്ചത് (-Cash)", cash: amt, bank: 0, bill: 0, isLoanOut: true });
            }
          }
        }
      });

      runningBal = openingBal;
      statementRows.forEach(r => {
        if (r.isLoanIn) runningBal += r.bill;
        else runningBal -= r.cash;
        r.bal = runningBal;
      });
    }
  }

  // 4. EMPLOYEES STATEMENT
  else if (type === 'employee') {
    if (isAllEmployeesMode) {
      partyName = `TOTAL EMPLOYEES SALARY STATEMENT (${monthVal})`;
      emps.forEach(emp => {
        let monthlySalary = parseFloat(emp.monthly_salary) || 0;
        let staffPaid = 0;
        let empClean = cleanPartyName(emp.name);

        allTx.forEach(t => {
          if (t && t.type === 'salary' && cleanPartyName(t.party_name).includes(empClean)) {
            let tDate = parseStandardDate(t.date);
            if (tDate >= fromDate && tDate <= toDate) {
              staffPaid += (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0));
            }
          }
        });

        // ആ മാസം അവസാനിച്ച തീയതി വരെയുള്ള ബാക്കി
        let pendingBal = 0;
        let accrued = parseFloat(emp.opening_advance || emp.opening_balance) || 0;
        let joinD = parseToDateObj(emp.joining_date || "2026-01-01");
        let targetD = parseToDateObj(toDate);
        if (targetD >= joinD && monthlySalary > 0) {
          let k = 0;
          while (true) {
            let nextCycle = new Date(joinD.getFullYear(), joinD.getMonth() + k + 1, joinD.getDate());
            if (targetD >= nextCycle) k++;
            else break;
          }
          accrued += (k * monthlySalary);
        }
        let totalAllTimePaid = 0;
        allTx.forEach(t => {
          if (t && t.type === 'salary' && cleanPartyName(t.party_name).includes(empClean)) {
            if (parseStandardDate(t.date) <= toDate) {
              totalAllTimePaid += (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0));
            }
          }
        });
        pendingBal = accrued - totalAllTimePaid;

        if (monthlySalary > 0 || staffPaid > 0 || Math.abs(pendingBal) > 0.01) {
          employeesConsolidatedSummary.push({ name: emp.name, salary: monthlySalary, paid: staffPaid, closing: pendingBal });
          totalSalesOrBills += monthlySalary; totalPaidOrCollected += staffPaid; runningBal += pendingBal;
        }
      });
      employeesConsolidatedSummary.sort((a, b) => b.closing - a.closing);
    } else {
      const cleanEmpName = cleanPartyName(partyVal);
      const emp = emps.find(e => e && cleanPartyName(e.name) === cleanEmpName);
      partyName = emp ? emp.name.toUpperCase() : partyVal;

      if (emp) {
        let monthlySalary = parseFloat(emp.monthly_salary) || 0;
        let baseAdv = parseFloat(emp.opening_advance || emp.opening_balance) || 0;
        let joinD = parseToDateObj(emp.joining_date || "2026-01-01");
        let priorDate = new Date(parseInt(monthVal.split('-')[0]), parseInt(monthVal.split('-')[1]) - 1, 0);
        let priorStr = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, '0')}-${String(priorDate.getDate()).padStart(2, '0')}`;

        // ഓപ്പണിംഗ് കണക്കാക്കുന്നു
        let priorAccrued = baseAdv;
        let targetPrior = parseToDateObj(priorStr);
        if (targetPrior >= joinD && monthlySalary > 0) {
          let k = 0;
          while (true) {
            let nextCycle = new Date(joinD.getFullYear(), joinD.getMonth() + k + 1, joinD.getDate());
            if (targetPrior >= nextCycle) k++;
            else break;
          }
          priorAccrued += (k * monthlySalary);
        }
        let priorPaid = 0;
        allTx.forEach(t => {
          if (t && t.type === 'salary' && cleanPartyName(t.party_name).includes(cleanEmpName)) {
            if (parseStandardDate(t.date) < fromDate) {
              priorPaid += (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0));
            }
          }
        });
        openingBal = priorAccrued - priorPaid;

        // ആ മാസത്തെ ശമ്പളം
        totalSalesOrBills = monthlySalary;
        statementRows.push({ date: fromDate, desc: `മാസ ശമ്പളം (Monthly Accrued Salary)`, cash: 0, bank: 0, bill: monthlySalary });

        allTx.forEach(t => {
          if (t && t.type === 'salary' && cleanPartyName(t.party_name).includes(cleanEmpName)) {
            let tDate = parseStandardDate(t.date);
            if (tDate >= fromDate && tDate <= toDate) {
              let paid = Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0);
              totalPaidOrCollected += paid;
              statementRows.push({ date: tDate, desc: t.party_name.replace(/^Staff:\s*/i, "") || "Salary Advance Paid", cash: paid, bank: 0, bill: 0 });
            }
          }
        });

        statementRows.sort((a, b) => a.date.localeCompare(b.date));
        runningBal = openingBal;
        statementRows.forEach(r => {
          runningBal += (r.bill - r.cash);
          r.bal = runningBal;
        });
      }
    }
  }

  // 5. UTILITY BILLS STATEMENT
  else if (type === 'expense') {
    if (isAllUtilityBillsMode) {
      partyName = `TOTAL RECURRING UTILITY BILLS STATEMENT (${monthVal})`;
      exps.forEach(ex => {
        let exOpen = parseFloat(ex.opening_balance) || 0;
        let exBills = 0, exPaid = 0;
        let exClean = cleanPartyName(ex.name);

        allTx.forEach(t => {
          if (!t) return;
          let tClean = cleanPartyName(t.party_name);
          if (tClean.startsWith(exClean) || tClean === exClean) {
            let tDate = parseStandardDate(t.date);
            let bAmt = (t.type === 'expense_bill') ? (parseFloat(t.credit_amount) || 0) : 0;
            let pAmt = (t.type === 'expense') ? (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0)) : 0;
            if (tDate < fromDate) exOpen += (bAmt - pAmt);
            else if (tDate >= fromDate && tDate <= toDate) { exBills += bAmt; exPaid += pAmt; }
          }
        });

        let exClose = exOpen + exBills - exPaid;
        if (exBills > 0 || exPaid > 0 || Math.abs(exClose) > 0.01) {
          utilitiesConsolidatedSummary.push({ name: ex.name, opening: exOpen, bills: exBills, paid: exPaid, closing: exClose });
          openingBal += exOpen; totalSalesOrBills += exBills; totalPaidOrCollected += exPaid; runningBal += exClose;
        }
      });
      utilitiesConsolidatedSummary.sort((a, b) => b.closing - a.closing);
    } else {
      const expClean = cleanPartyName(partyVal);
      const ex = exps.find(e => cleanPartyName(e.name) === expClean);
      partyName = ex ? ex.name.toUpperCase() : partyVal;
      openingBal = parseFloat(ex?.opening_balance) || 0;

      allTx.forEach(t => {
        if (!t) return;
        let tClean = cleanPartyName(t.party_name);
        if (tClean.startsWith(expClean) || tClean === expClean) {
          let tDate = parseStandardDate(t.date);
          let bAmt = (t.type === 'expense_bill') ? (parseFloat(t.credit_amount) || 0) : 0;
          let pAmt = (t.type === 'expense') ? (Math.abs(parseFloat(t.cash_amount) || 0) + Math.abs(parseFloat(t.bank_amount) || 0)) : 0;
          if (tDate < fromDate) openingBal += (bAmt - pAmt);
          else if (tDate >= fromDate && tDate <= toDate) {
            totalSalesOrBills += bAmt;
            totalPaidOrCollected += pAmt;
            statementRows.push({ date: tDate, desc: t.party_name, cash: pAmt, bank: 0, bill: bAmt });
          }
        }
      });

      runningBal = openingBal;
      statementRows.forEach(r => {
        runningBal += (r.bill - r.cash);
        r.bal = runningBal;
      });
    }
  }

  // UI UPDATE
  const statHead = document.getElementById("statHeaderTitle");
  const statPeriod = document.getElementById("statPeriodLabel");
  const statOpen = document.getElementById("statOpeningBalText");
  const statSales = document.getElementById("statMonthSalesText");
  const statPaid = document.getElementById("statMonthPaidText");
  const statClose = document.getElementById("statClosingBalText");

  if (statHead) statHead.innerText = `${partyName}`;
  if (statPeriod) statPeriod.innerText = `Period: ${monthVal}`;
  if (statOpen) statOpen.innerText = `${openingBal.toLocaleString('en-IN')}`;
  if (statSales) statSales.innerText = `${totalSalesOrBills.toLocaleString('en-IN')}`;
  if (statPaid) statPaid.innerText = `${totalPaidOrCollected.toLocaleString('en-IN')}`;
  if (statClose) statClose.innerText = `${runningBal.toLocaleString('en-IN')}`;

  let tableHtml = "";

  if (isAllCustomersMode) {
    tableHtml = `<table class="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm table-fixed"><thead><tr class="bg-emerald-900 text-white font-black text-center border-b text-[10px]"><th class="p-1 w-6">#</th><th class="p-1 w-2/6 text-left">Customer</th><th class="p-1 w-1/6">Opening</th><th class="p-1 w-1/6">Sales</th><th class="p-1 w-1/6">Paid</th><th class="p-1 w-1/6 bg-emerald-950">Net Due (${monthVal})</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
    if (customersConsolidatedSummary.length === 0) tableHtml += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold">ഇടപാടുകൾ / കുടിശ്ശികകൾ ഇല്ല</td></tr>`;
    else {
      customersConsolidatedSummary.forEach((r, idx) => {
        tableHtml += `<tr class="text-center hover:bg-slate-50"><td class="p-1">${idx + 1}</td><td class="p-1 text-left truncate">${formatShortName(r.name)}</td><td class="p-1">${r.opening.toLocaleString('en-IN')}</td><td class="p-1 text-amber-700">${r.sales.toLocaleString('en-IN')}</td><td class="p-1 text-emerald-700">${r.paid.toLocaleString('en-IN')}</td><td class="p-1 font-black text-emerald-900">${r.closing.toLocaleString('en-IN')}</td></tr>`;
      });
    }
    tableHtml += `</tbody></table>`;
  } else if (isAllVendorsMode) {
    tableHtml = `<table class="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm table-fixed"><thead><tr class="bg-blue-900 text-white font-black text-center border-b text-[10px]"><th class="p-1 w-6">#</th><th class="p-1 w-2/6 text-left">Vendor</th><th class="p-1 w-1/6">Opening</th><th class="p-1 w-1/6">Purchase</th><th class="p-1 w-1/6">Paid</th><th class="p-1 w-1/6 bg-blue-950">Net Due (${monthVal})</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
    if (vendorsConsolidatedSummary.length === 0) tableHtml += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold">ഇടപാടുകൾ / ബാധ്യതകൾ ഇല്ല</td></tr>`;
    else {
      vendorsConsolidatedSummary.forEach((r, idx) => {
        tableHtml += `<tr class="text-center hover:bg-slate-50"><td class="p-1">${idx + 1}</td><td class="p-1 text-left truncate">${formatShortName(r.name)}</td><td class="p-1">${r.opening.toLocaleString('en-IN')}</td><td class="p-1 text-blue-700">${r.purchases.toLocaleString('en-IN')}</td><td class="p-1 text-emerald-700">${r.paid.toLocaleString('en-IN')}</td><td class="p-1 font-black text-rose-700">${r.closing.toLocaleString('en-IN')}</td></tr>`;
      });
    }
    tableHtml += `</tbody></table>`;
  } else if (isAllLoansMode) {
    tableHtml = `<table class="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm table-fixed"><thead><tr class="bg-purple-900 text-white font-black text-center border-b text-[10px]"><th class="p-1 w-6">#</th><th class="p-1 w-2/6 text-left">Lender Name</th><th class="p-1 w-1/6">Opening</th><th class="p-1 w-1/6">Borrowed (+)</th><th class="p-1 w-1/6">Repaid (-)</th><th class="p-1 w-1/6 bg-purple-950">Net Due (${monthVal})</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
    if (loansConsolidatedSummary.length === 0) tableHtml += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold">ലോൺ ബാധ്യതകൾ ഇല്ല</td></tr>`;
    else {
      loansConsolidatedSummary.forEach((r, idx) => {
        tableHtml += `<tr class="text-center hover:bg-slate-50"><td class="p-1">${idx + 1}</td><td class="p-1 text-left truncate">${formatShortName(r.name)}</td><td class="p-1">${r.opening.toLocaleString('en-IN')}</td><td class="p-1 text-emerald-700">+${r.borrowed.toLocaleString('en-IN')}</td><td class="p-1 text-rose-700">-${r.repaid.toLocaleString('en-IN')}</td><td class="p-1 font-black text-purple-950">${r.closing.toLocaleString('en-IN')}</td></tr>`;
      });
    }
    tableHtml += `</tbody></table>`;
  } else if (type === 'employee' && isAllEmployeesMode) {
    tableHtml = `<table class="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm table-fixed"><thead><tr class="bg-purple-900 text-white font-black text-center border-b text-[10px]"><th class="p-1 w-6">#</th><th class="p-1 w-2/6 text-left">Staff Name</th><th class="p-1 w-1/6">Salary</th><th class="p-1 w-1/6">Paid</th><th class="p-1 w-1/6 bg-purple-950">Pending Due (${monthVal})</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
    if (employeesConsolidatedSummary.length === 0) tableHtml += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold">ശമ്പളം ബാക്കിയുള്ള ജീവനക്കാർ ഇല്ല</td></tr>`;
    else {
      employeesConsolidatedSummary.forEach((r, idx) => {
        tableHtml += `<tr class="text-center hover:bg-slate-50"><td class="p-1">${idx + 1}</td><td class="p-1 text-left truncate">${formatShortName(r.name)}</td><td class="p-1">${r.salary.toLocaleString('en-IN')}</td><td class="p-1 text-emerald-700">${r.paid.toLocaleString('en-IN')}</td><td class="p-1 font-black text-purple-950">${r.closing.toLocaleString('en-IN')}</td></tr>`;
      });
    }
    tableHtml += `</tbody></table>`;
  } else if (isAllUtilityBillsMode) {
    tableHtml = `<table class="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm table-fixed"><thead><tr class="bg-amber-900 text-white font-black text-center border-b text-[10px]"><th class="p-1 w-6">#</th><th class="p-1 w-2/6 text-left">Utility / Bill</th><th class="p-1 w-1/6">Opening</th><th class="p-1 w-1/6">Bills</th><th class="p-1 w-1/6">Paid</th><th class="p-1 w-1/6 bg-amber-950">Bill Due (${monthVal})</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
    if (utilitiesConsolidatedSummary.length === 0) tableHtml += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold">കുടിശ്ശികയുള്ള ബില്ലുകൾ ഇല്ല</td></tr>`;
    else {
      utilitiesConsolidatedSummary.forEach((r, idx) => {
        tableHtml += `<tr class="text-center hover:bg-slate-50"><td class="p-1">${idx + 1}</td><td class="p-1 text-left truncate">${formatShortName(r.name)}</td><td class="p-1">${r.opening.toLocaleString('en-IN')}</td><td class="p-1 text-indigo-700">${r.bills.toLocaleString('en-IN')}</td><td class="p-1 text-emerald-700">${r.paid.toLocaleString('en-IN')}</td><td class="p-1 font-black text-amber-900">${r.closing.toLocaleString('en-IN')}</td></tr>`;
      });
    }
    tableHtml += `</tbody></table>`;
  } else {
    tableHtml = `<table class="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm table-fixed"><thead><tr class="bg-indigo-900 text-white font-black text-center border-b text-[10px]"><th class="p-1 w-1/5 text-left">Date</th><th class="p-1 w-2/5 text-left">Particulars</th><th class="p-1 w-1/5">Paid</th><th class="p-1 w-1/5">Bill / Added</th><th class="p-1 w-1/5">Balance</th></tr></thead><tbody class="divide-y divide-slate-100 font-bold text-[10px]">`;
    if (statementRows.length === 0) {
      tableHtml += `<tr><td colspan="5" class="p-3 text-center text-slate-400 font-bold">ഈ മാസത്തിൽ ഇടപാടുകൾ ഒന്നും ഇല്ല</td></tr>`;
    } else {
      statementRows.forEach(r => {
        let payStr = (r.cash > 0) ? `${r.cash.toLocaleString('en-IN')}` : '-';
        let billStr = (r.bill > 0) ? `${r.bill.toLocaleString('en-IN')}` : '-';
        tableHtml += `<tr class="text-center hover:bg-slate-50"><td class="p-1 text-left text-slate-600">${r.date}</td><td class="p-1 text-left truncate">${formatShortName(r.desc)}</td><td class="p-1 text-emerald-700">${payStr}</td><td class="p-1 text-amber-700">${billStr}</td><td class="p-1 font-black">${r.bal.toLocaleString('en-IN')}</td></tr>`;
      });
    }
    tableHtml += `</tbody></table>`;
  }

  const statTable = document.getElementById("statTableContainer");
  if (statTable) statTable.innerHTML = tableHtml;

  currentStatementDataForWA = {
    partyName: partyName,
    type: type,
    month: monthVal,
    openingBal: openingBal,
    totalSales: totalSalesOrBills,
    totalPaid: totalPaidOrCollected,
    closingBal: runningBal
  };
}

// ========================================================
// 4. WHATSAPP SHARING LOGIC
// ========================================================
function shareActiveReportWhatsApp() {
  if (currentReportMode === 'statement') {
    if (!currentStatementDataForWA) return alert("Generate statement before sharing!");
    const d = currentStatementDataForWA;
    let waText = `📊 *${((window.currentShop && window.currentShop.name) ? window.currentShop.name : "ALNASSR").toUpperCase()} - ACCOUNT STATEMENT*\n` +
                 `👤 *Account:* ${d.partyName}\n` +
                 `📅 *Month:* ${d.month}\n` +
                 `--------------------------------\n` +
                 `🔹 *Old Opening Balance:* ${d.openingBal.toLocaleString('en-IN')}\n` +
                 `🛒 *Total Bills / Sales / Added:* ${d.totalSales.toLocaleString('en-IN')}\n` +
                 `💵 *Total Payments / Collected:* ${d.totalPaid.toLocaleString('en-IN')}\n` +
                 `🔴 *Closing Balance Due (${d.month}):* ${d.closingBal.toLocaleString('en-IN')}\n`;
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(waText), '_blank');
  } else {
    let d = currentReportDataForWA;
    let waText = `📊 *${d.shopName} - ${d.title}*\n` +
                 `📅 ${d.dateLabel}\n` +
                 `--------------------------------\n` +
                 `🛒 *ആകെ സെയിൽസ്:* ${d.sale}\n` +
                 `🚚 *ആകെ പർച്ചേസ്:* ${d.purchase}\n` +
                 `⚡ *ആകെ ചിലവുകൾ:* ${d.expense}\n` +
                 `--------------------------------\n` +
                 `🤝 *ലോൺ ഇടപാടുകൾ:*\n` +
                 `  📥 വാങ്ങിയത് (+): ${d.loanIn || 0}\n` +
                 `  📤 തിരിച്ചടച്ചത് (-): ${d.loanOut || 0}\n` +
                 `--------------------------------\n` +
                 `📋 *15% വാറ്റ് സമ്മറി (VAT):*\n` +
                 `  🔺 സെയിൽസ് വാറ്റ് (Output): ${d.vatOutput} SR\n` +
                 `  🔻 പർച്ചേസ് വാറ്റ് (Input): ${d.vatInput} SR\n` +
                 `  🔹 അടയ്ക്കാനുള്ള വാറ്റ്: ${d.vatNet} SR\n` +
                 `--------------------------------\n` +
                 `💵 *ലിക്വിഡ് ഫണ്ട്:* Cash: ${d.cash} | Bank: ${d.bank}\n` +
                 `--------------------------------\n` +
                 `📌 *ബാക്കികൾ (${d.dateLabel}):*\n` +
                 `  🛒 കസ്റ്റമർ തരാനുള്ളത്: ${d.custBal}\n` +
                 `  🚚 വെണ്ടർക്ക് കൊടുക്കാനുള്ളത്: ${d.vendorBal}\n` +
                 `  👥 സ്റ്റാഫ് സാലറി ബാക്കി: ${d.empBal}\n` +
                 `  🤝 ലോൺ കൊടുക്കാനുള്ളത്: ${d.loanBal || 0}`;
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(waText), '_blank');
  }
}

// ========================================================
// 5. BULK EXCEL IMPORT & EXPORT
// ========================================================
function downloadMasterExcel() {
  const { custs, vends, emps, exps, loans } = getMasterData();
  try {
    if (typeof XLSX === 'undefined') return alert("Excel ലൈബ്രറി ലോഡ് ആയിട്ടില്ല!");
    const wb = XLSX.utils.book_new();

    const wsCust = XLSX.utils.json_to_sheet(custs.map(c => ({ "Name": c.name, "Type": c.type || 'credit', "Agent": getCustomerAgentName(c), "Opening_Balance": c.opening_balance || 0 })));
    XLSX.utils.book_append_sheet(wb, wsCust, "Customers");

    const wsVend = XLSX.utils.json_to_sheet(vends.map(v => ({ "Name": v.name, "Type": v.type || 'credit', "Opening_Balance": v.opening_balance || 0 })));
    XLSX.utils.book_append_sheet(wb, wsVend, "Vendors");

    const wsEmp = XLSX.utils.json_to_sheet(emps.map(e => ({ "Name": e.name, "Monthly_Salary": e.monthly_salary || 0, "Joining_Date": e.joining_date || '', "Opening_Advance": e.opening_advance || e.opening_balance || 0, "Status": e.status || 'active' })));
    XLSX.utils.book_append_sheet(wb, wsEmp, "Employees");

    const wsExp = XLSX.utils.json_to_sheet(exps.map(ex => ({ "Name": ex.name, "Type": ex.type || 'regular', "Opening_Balance": ex.opening_balance || 0 })));
    XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");

    const wsLoan = XLSX.utils.json_to_sheet(loans.map(l => ({ "Name": l.name, "Opening_Balance": l.opening_balance || 0 })));
    XLSX.utils.book_append_sheet(wb, wsLoan, "Loans");

    XLSX.writeFile(wb, `ALNASSR_Master_Data_${window.currentShopId || 'POS'}.xlsx`);
  } catch (err) {
    alert("Excel Export Error: " + err.message);
  }
}