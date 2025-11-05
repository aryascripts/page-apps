// Mortgage Term Amortization Logic

/**
 * Calculate monthly payment using Canadian mortgage formula
 * M = P * [ r(1+r)^n ] / [ (1+r)^n – 1 ]
 */
export function calculateMonthlyPayment({ principal, annualRate, months }) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;

  const monthlyRate = annualRate / 100 / 12;
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, months);
  const denominator = Math.pow(1 + monthlyRate, months) - 1;

  return principal * (numerator / denominator);
}

/**
 * Simulate a single term of the mortgage
 * Returns: { months, termData, remainingBalance, remainingMonths }
 */
export function simulateTerm({
  startingBalance,
  annualRate,
  termLengthMonths,
  remainingAmortizationMonths,
  extraPayment,
}) {
  const monthlyRate = annualRate / 100 / 12;
  const requiredPayment = calculateMonthlyPayment({
    principal: startingBalance,
    annualRate,
    months: remainingAmortizationMonths,
  });

  const months = [];
  let balance = startingBalance;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalExtra = 0;

  const monthsToSimulate = Math.min(
    termLengthMonths,
    remainingAmortizationMonths
  );

  for (let month = 0; month < monthsToSimulate; month++) {
    const startingBalanceThisMonth = balance;
    const interest = balance * monthlyRate;
    const principalFromPayment = requiredPayment - interest;
    const totalPrincipalThisMonth = principalFromPayment + extraPayment;

    balance = Math.max(0, balance - totalPrincipalThisMonth);
    totalInterest += interest;
    totalPrincipal += totalPrincipalThisMonth;
    totalExtra += extraPayment;

    months.push({
      startingBalance: startingBalanceThisMonth,
      requiredPayment: requiredPayment,
      extraPayment: extraPayment,
      totalPayment: requiredPayment + extraPayment,
      interest: interest,
      principal: totalPrincipalThisMonth,
      endingBalance: balance,
    });

    // Stop if balance is paid off
    if (balance <= 0.01) {
      break;
    }
  }

  const actualMonths = months.length;
  // In Canadian mortgages, remaining amortization is reduced by term length (not actual months)
  // Extra payments don't reduce the amortization period, they just pay down principal faster
  const newRemainingMonths = Math.max(
    0,
    remainingAmortizationMonths - termLengthMonths
  );

  return {
    months: months,
    termData: {
      startingBalance: startingBalance,
      endingBalance: balance,
      interestRate: annualRate,
      monthlyPayment: requiredPayment,
      totalInterest: totalInterest,
      totalPrincipal: totalPrincipal,
      totalExtra: totalExtra,
      monthsInTerm: actualMonths,
    },
    remainingBalance: balance,
    remainingMonths: newRemainingMonths,
  };
}

/**
 * Simulate term without extra payments (for interest saved calculation)
 */
export function simulateTermWithoutExtra({
  startingBalance,
  annualRate,
  termLengthMonths,
  remainingAmortizationMonths,
}) {
  const monthlyRate = annualRate / 100 / 12;
  const requiredPayment = calculateMonthlyPayment({
    principal: startingBalance,
    annualRate,
    months: remainingAmortizationMonths,
  });

  let balance = startingBalance;
  let totalInterest = 0;

  const monthsToSimulate = Math.min(
    termLengthMonths,
    remainingAmortizationMonths
  );

  for (let month = 0; month < monthsToSimulate; month++) {
    const interest = balance * monthlyRate;
    const principal = requiredPayment - interest;
    balance = Math.max(0, balance - principal);
    totalInterest += interest;

    if (balance <= 0.01) break;
  }

  return totalInterest;
}

/**
 * Simulate the full mortgage using continuous amortization
 * (Payment calculated once at start, extra payments applied continuously)
 */
export function simulateFullMortgage({
  initialBalance,
  amortizationYears,
  termLengthYears,
  extraPayment,
  termRates,
}) {
  const amortizationMonths = amortizationYears * 12;
  const termLengthMonths = termLengthYears * 12;
  const numTerms = Math.ceil(amortizationMonths / termLengthMonths);

  // Ensure we have enough rates
  if (termRates.length < numTerms) {
    const lastRate = termRates[termRates.length - 1];
    while (termRates.length < numTerms) {
      termRates.push(lastRate);
    }
  }

  // Calculate initial monthly payment (based on initial rate and full amortization)
  const initialRate = termRates[0];
  const requiredPayment = calculateMonthlyPayment({
    principal: initialBalance,
    annualRate: initialRate,
    months: amortizationMonths,
  });

  // Simulate WITH extra payments
  const allMonths = [];
  let currentBalance = initialBalance;
  let totalInterestPaid = 0;
  let totalExtraPaid = 0;
  let monthNumber = 1;
  let currentTerm = 1;
  let monthsInCurrentTerm = 0;

  // Track term summaries
  const termSummaries = [];
  let termStartBalance = initialBalance;
  let termTotalInterest = 0;
  let termTotalPrincipal = 0;
  let termTotalExtra = 0;

  while (currentBalance > 0.01 && monthNumber <= amortizationMonths) {
    // Determine which term we're in and get the rate
    const termIndex = Math.floor((monthNumber - 1) / termLengthMonths);
    const termRate = termRates[Math.min(termIndex, termRates.length - 1)];
    const monthlyRate = termRate / 100 / 12;

    // Calculate interest and principal for this month
    const interest = currentBalance * monthlyRate;
    const principalFromPayment = requiredPayment - interest;
    const totalPrincipalThisMonth = principalFromPayment + extraPayment;

    // Update balance
    currentBalance = Math.max(0, currentBalance - totalPrincipalThisMonth);

    // Track totals
    totalInterestPaid += interest;
    totalExtraPaid += extraPayment;

    // Track term data
    termTotalInterest += interest;
    termTotalPrincipal += totalPrincipalThisMonth;
    termTotalExtra += extraPayment;
    monthsInCurrentTerm++;

    // Add month to schedule
    allMonths.push({
      startingBalance: currentBalance + totalPrincipalThisMonth,
      requiredPayment: requiredPayment,
      extraPayment: extraPayment,
      totalPayment: requiredPayment + extraPayment,
      interest: interest,
      principal: totalPrincipalThisMonth,
      endingBalance: currentBalance,
      monthNumber: monthNumber,
      termNumber: currentTerm,
    });

    // Check if we've completed a term
    if (monthsInCurrentTerm >= termLengthMonths || currentBalance <= 0.01) {
      termSummaries.push({
        termNumber: currentTerm,
        startingBalance: termStartBalance,
        endingBalance: currentBalance,
        interestRate: termRate,
        monthlyPayment: requiredPayment,
        totalInterest: termTotalInterest,
        totalPrincipal: termTotalPrincipal,
        totalExtra: termTotalExtra,
        monthsInTerm: monthsInCurrentTerm,
        interestSaved: 0, // Will calculate below
      });

      // Reset for next term
      if (currentBalance > 0.01) {
        currentTerm++;
        termStartBalance = currentBalance;
        termTotalInterest = 0;
        termTotalPrincipal = 0;
        termTotalExtra = 0;
        monthsInCurrentTerm = 0;
      }
    }

    monthNumber++;

    // Stop if balance is paid off
    if (currentBalance <= 0.01) {
      break;
    }
  }

  // Simulate WITHOUT extra payments for comparison
  let balanceWithoutExtra = initialBalance;
  let totalInterestWithoutExtra = 0;
  let monthNumWithoutExtra = 1;

  while (
    balanceWithoutExtra > 0.01 &&
    monthNumWithoutExtra <= amortizationMonths
  ) {
    const termIndex = Math.floor((monthNumWithoutExtra - 1) / termLengthMonths);
    const termRate = termRates[Math.min(termIndex, termRates.length - 1)];
    const monthlyRate = termRate / 100 / 12;

    const interest = balanceWithoutExtra * monthlyRate;
    const principal = requiredPayment - interest;
    balanceWithoutExtra = Math.max(0, balanceWithoutExtra - principal);
    totalInterestWithoutExtra += interest;

    monthNumWithoutExtra++;
    if (balanceWithoutExtra <= 0.01) break;
  }

  // Calculate interest saved
  const totalInterestSaved = totalInterestWithoutExtra - totalInterestPaid;

  // Update term summaries with interest saved
  // For simplicity, distribute interest saved proportionally to terms
  let remainingInterestSaved = totalInterestSaved;
  termSummaries.forEach((term, index) => {
    if (index < termSummaries.length - 1) {
      // Distribute proportionally based on term interest
      const proportion = term.totalInterest / totalInterestPaid;
      term.interestSaved = totalInterestSaved * proportion;
      remainingInterestSaved -= term.interestSaved;
    } else {
      // Last term gets the remainder
      term.interestSaved = remainingInterestSaved;
    }
  });

  // Calculate total time
  const totalMonths = allMonths.length;
  const totalYears = Math.floor(totalMonths / 12);
  const remainingMonthsFinal = totalMonths % 12;

  return {
    allMonths: allMonths,
    termSummaries: termSummaries,
    totals: {
      totalMonths: totalMonths,
      totalYears: totalYears,
      remainingMonths: remainingMonthsFinal,
      totalInterestPaid: totalInterestPaid,
      totalExtraPaid: totalExtraPaid,
      totalInterestSaved: totalInterestSaved,
      finalBalance: currentBalance,
    },
  };
}
