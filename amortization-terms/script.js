// Main application logic and UI handlers
import { formatCurrency, showNotification } from "./helpers.js";
import { simulateFullMortgage } from "./calculator.js";

// Store months globally for filtering
let currentMonths = [];

/**
 * Build summary grid HTML
 */
function buildSummaryGrid(totals) {
  return `
    <div class="summary-item">
      <span class="summary-label">Time to Pay Off</span>
      <span class="summary-value">${totals.totalYears} years, ${
    totals.remainingMonths
  } months</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Total Interest Paid</span>
      <span class="summary-value">${formatCurrency(
        totals.totalInterestPaid
      )}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Total Extra Payments</span>
      <span class="summary-value">${formatCurrency(
        totals.totalExtraPaid
      )}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Interest Saved</span>
      <span class="summary-value highlight">${formatCurrency(
        totals.totalInterestSaved
      )}</span>
    </div>
  `;
}

/**
 * Build term summary table rows
 */
function buildTermSummaryRows(termSummaries) {
  return termSummaries
    .map(
      (term) => `
    <tr>
      <td>${term.termNumber}</td>
      <td>${formatCurrency(term.startingBalance)}</td>
      <td>${formatCurrency(term.endingBalance)}</td>
      <td>${term.interestRate.toFixed(2)}%</td>
      <td>${formatCurrency(term.monthlyPayment)}</td>
      <td>${formatCurrency(term.totalInterest)}</td>
      <td>${formatCurrency(term.totalPrincipal)}</td>
      <td>${formatCurrency(term.totalExtra)}</td>
      <td class="highlight">${formatCurrency(term.interestSaved)}</td>
    </tr>
  `
    )
    .join("");
}

/**
 * Build monthly table rows
 */
function buildMonthlyTableRows(months, filter = "all") {
  let filteredMonths = months;

  if (filter === "first12") {
    filteredMonths = months.slice(0, 12);
  } else if (filter === "first24") {
    filteredMonths = months.slice(0, 24);
  } else if (filter === "last12") {
    filteredMonths = months.slice(-12);
  }

  return filteredMonths
    .map(
      (month) => `
    <tr>
      <td>${month.monthNumber}</td>
      <td>${formatCurrency(month.startingBalance)}</td>
      <td>${formatCurrency(month.requiredPayment)}</td>
      <td>${formatCurrency(month.extraPayment)}</td>
      <td>${formatCurrency(month.totalPayment)}</td>
      <td>${formatCurrency(month.interest)}</td>
      <td>${formatCurrency(month.principal)}</td>
      <td>${formatCurrency(month.endingBalance)}</td>
      <td>${month.termNumber}</td>
    </tr>
  `
    )
    .join("");
}

/**
 * Handle calculate button click
 */
function handleCalculate() {
  // Get input values
  const initialBalance = parseFloat(
    document.getElementById("initialBalance").value
  );
  const initialRate = parseFloat(document.getElementById("initialRate").value);
  const amortizationYears = parseInt(
    document.getElementById("amortizationYears").value
  );
  const termLengthYears = parseInt(
    document.getElementById("termLengthYears").value
  );
  const extraPayment = parseFloat(
    document.getElementById("extraPayment").value || 0
  );

  // Get term rates
  const termRateInputs = document.querySelectorAll(".term-rate");
  const termRates = Array.from(termRateInputs)
    .map((input) => {
      const value = parseFloat(input.value);
      return isNaN(value) ? null : value;
    })
    .filter((rate) => rate !== null);

  // Validation
  if (isNaN(initialBalance) || initialBalance <= 0) {
    showNotification("Please enter a valid initial mortgage balance.", "error");
    return;
  }

  if (isNaN(initialRate) || initialRate < 0 || initialRate > 100) {
    showNotification(
      "Please enter a valid initial interest rate (0-100%).",
      "error"
    );
    return;
  }

  if (isNaN(amortizationYears) || amortizationYears <= 0) {
    showNotification("Please enter a valid amortization period.", "error");
    return;
  }

  if (isNaN(termLengthYears) || termLengthYears <= 0) {
    showNotification("Please enter a valid term length.", "error");
    return;
  }

  if (termRates.length === 0) {
    showNotification("Please enter at least one term interest rate.", "error");
    return;
  }

  // Build term rates array: initial rate for term 1, then user-provided rates for subsequent terms
  const allTermRates = [initialRate, ...termRates];

  // Calculate
  try {
    const results = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates: allTermRates,
    });

    // Store months for filtering
    currentMonths = results.allMonths;

    // Display results
    document.getElementById("summaryGrid").innerHTML = buildSummaryGrid(
      results.totals
    );
    document.getElementById("termSummaryBody").innerHTML = buildTermSummaryRows(
      results.termSummaries
    );
    document.getElementById("monthlyTableBody").innerHTML =
      buildMonthlyTableRows(results.allMonths);

    // Show results section
    document.getElementById("resultsSection").style.display = "block";

    // Scroll to results
    document.getElementById("resultsSection").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    showNotification("Calculation completed successfully!", "success");
  } catch (error) {
    showNotification(`Error during calculation: ${error.message}`, "error");
    console.error(error);
  }
}

/**
 * Handle add term button click
 */
function handleAddTerm() {
  const container = document.getElementById("termRatesContainer");
  const termInputs = container.querySelectorAll(".term-rate-input");
  const nextTermNum = termInputs.length + 2; // +2 because term 1 uses initial rate

  const newInput = document.createElement("div");
  newInput.className = "term-rate-input";
  newInput.innerHTML = `
    <label>
      <span>Term ${nextTermNum} Rate:</span>
      <input
        type="number"
        class="term-rate"
        data-term="${nextTermNum}"
        min="0"
        max="100"
        step="0.01"
        placeholder="5.5"
      />
    </label>
  `;

  container.appendChild(newInput);
}

/**
 * Handle monthly table filter change
 */
function handleMonthlyTableFilter() {
  const filter = document.getElementById("monthlyTableFilter").value;
  const monthlyTableBody = document.getElementById("monthlyTableBody");

  if (currentMonths.length > 0) {
    monthlyTableBody.innerHTML = buildMonthlyTableRows(currentMonths, filter);
  }
}

// Initialize - ensure DOM is ready (though modules are deferred)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  document
    .getElementById("calculateBtn")
    .addEventListener("click", handleCalculate);

  document
    .getElementById("addTermBtn")
    .addEventListener("click", handleAddTerm);

  document
    .getElementById("monthlyTableFilter")
    .addEventListener("change", handleMonthlyTableFilter);
}
