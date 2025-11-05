// Unit tests for mortgage calculator functions
import { describe, it, expect } from "vitest";
import {
  calculateMonthlyPayment,
  simulateTerm,
  simulateTermWithoutExtra,
  simulateFullMortgage,
} from "../calculator.js";

describe("calculateMonthlyPayment", () => {
  it("should calculate correct monthly payment for standard mortgage", () => {
    // $500,000 at 5.5% for 25 years (300 months)
    const principal = 500000;
    const annualRate = 5.5;
    const months = 300;

    const payment = calculateMonthlyPayment({ principal, annualRate, months });

    // Expected: ~$3,070.44 (calculated using formula)
    // Formula: M = P * [ r(1+r)^n ] / [ (1+r)^n – 1 ]
    expect(payment).toBeCloseTo(3070.44, 2);
    expect(payment).toBeGreaterThan(3000);
    expect(payment).toBeLessThan(3200);
  });

  it("should return 0 for zero or negative principal", () => {
    expect(
      calculateMonthlyPayment({ principal: 0, annualRate: 5.5, months: 300 })
    ).toBe(0);
    expect(
      calculateMonthlyPayment({ principal: -100, annualRate: 5.5, months: 300 })
    ).toBe(0);
  });

  it("should return 0 for zero or negative months", () => {
    expect(
      calculateMonthlyPayment({ principal: 500000, annualRate: 5.5, months: 0 })
    ).toBe(0);
    expect(
      calculateMonthlyPayment({
        principal: 500000,
        annualRate: 5.5,
        months: -10,
      })
    ).toBe(0);
  });

  it("should handle zero interest rate", () => {
    const principal = 500000;
    const months = 300;
    const payment = calculateMonthlyPayment({
      principal,
      annualRate: 0,
      months,
    });

    expect(payment).toBe(principal / months);
    expect(payment).toBeCloseTo(1666.67, 2);
  });

  it("should calculate correctly for different interest rates", () => {
    const principal = 100000;
    const months = 240; // 20 years

    const rate3 = calculateMonthlyPayment({
      principal,
      annualRate: 3.0,
      months,
    });
    const rate5 = calculateMonthlyPayment({
      principal,
      annualRate: 5.0,
      months,
    });
    const rate7 = calculateMonthlyPayment({
      principal,
      annualRate: 7.0,
      months,
    });

    // Higher rate should result in higher payment
    expect(rate3).toBeLessThan(rate5);
    expect(rate5).toBeLessThan(rate7);

    // Verify approximate values
    expect(rate3).toBeCloseTo(554.6, 2);
    expect(rate5).toBeCloseTo(659.96, 2);
    expect(rate7).toBeCloseTo(775.3, 2);
  });

  it("should calculate correctly for different amortization periods", () => {
    const principal = 500000;
    const annualRate = 5.5;

    const payment15 = calculateMonthlyPayment({
      principal,
      annualRate,
      months: 15 * 12,
    });
    const payment25 = calculateMonthlyPayment({
      principal,
      annualRate,
      months: 25 * 12,
    });
    const payment30 = calculateMonthlyPayment({
      principal,
      annualRate,
      months: 30 * 12,
    });

    // Longer amortization = lower monthly payment
    expect(payment15).toBeGreaterThan(payment25);
    expect(payment25).toBeGreaterThan(payment30);
  });

  it("should handle very high interest rates", () => {
    const principal = 100000;
    const months = 300;
    const annualRate = 20;
    const payment = calculateMonthlyPayment({
      principal,
      annualRate,
      months,
    });

    expect(payment).toBeGreaterThan(0);
    expect(payment).toBeLessThan(principal); // Should be less than principal

    // Verify that at least some amount goes towards principal
    // Even with high interest, payment should exceed first month's interest
    const monthlyRate = annualRate / 100 / 12;
    const firstMonthInterest = principal * monthlyRate;
    expect(payment).toBeGreaterThan(firstMonthInterest);

    // Verify principal is actually being paid down
    const firstMonthPrincipal = payment - firstMonthInterest;
    expect(firstMonthPrincipal).toBeGreaterThan(0);
  });

  it("should handle very small principal amounts", () => {
    const payment = calculateMonthlyPayment({
      principal: 100,
      annualRate: 5.5,
      months: 300,
    });
    expect(payment).toBeGreaterThan(0);
    expect(payment).toBeLessThan(1);
  });
});

describe("simulateTerm", () => {
  it("should simulate a term correctly without extra payments", () => {
    const startingBalance = 500000;
    const annualRate = 5.5;
    const termLengthMonths = 60; // 5 years
    const remainingAmortizationMonths = 300; // 25 years
    const extraPayment = 0;

    const result = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment,
    });

    expect(result.months).toHaveLength(60);
    expect(result.termData.startingBalance).toBe(startingBalance);
    expect(result.termData.totalExtra).toBe(0);
    expect(result.termData.monthsInTerm).toBe(60);
    expect(result.remainingMonths).toBe(240); // 300 - 60

    // Verify exact ending balance matches the last month's ending balance
    const lastMonth = result.months[result.months.length - 1];
    expect(result.termData.endingBalance).toBeCloseTo(
      lastMonth.endingBalance,
      2
    );
    expect(result.termData.endingBalance).toBeGreaterThan(0);
    expect(result.termData.endingBalance).toBeLessThan(startingBalance);

    // Verify ending balance is calculated correctly: starting - total principal paid
    expect(result.termData.endingBalance).toBeCloseTo(
      startingBalance - result.termData.totalPrincipal,
      2
    );
  });

  it("should apply extra payments correctly", () => {
    const startingBalance = 500000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;
    const extraPayment = 500;

    const result = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment,
    });

    // Should have extra payments applied
    expect(result.termData.totalExtra).toBe(500 * 60);
    expect(result.termData.endingBalance).toBeLessThan(
      startingBalance - result.termData.totalExtra
    );

    // Each month should have extra payment
    result.months.forEach((month) => {
      expect(month.extraPayment).toBe(500);
      expect(month.totalPayment).toBe(month.requiredPayment + 500);
      expect(month.principal).toBeGreaterThan(
        month.requiredPayment - month.interest
      );
    });
  });

  it("should stop early if balance is paid off", () => {
    const startingBalance = 10000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;
    const extraPayment = 10000; // Very large extra payment

    const result = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment,
    });

    // Should pay off quickly
    expect(result.termData.monthsInTerm).toBeLessThan(termLengthMonths);
    expect(result.termData.endingBalance).toBeLessThanOrEqual(0.01);
    expect(result.remainingBalance).toBeLessThanOrEqual(0.01);
  });

  it("should calculate interest correctly", () => {
    const startingBalance = 100000;
    const annualRate = 6.0; // 6% annual
    const termLengthMonths = 12; // 1 year
    const remainingAmortizationMonths = 300;
    const extraPayment = 0;

    const result = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment,
    });

    // Total interest should be approximately 6% of average balance
    // Rough check: should be around $6,000 for first year
    expect(result.termData.totalInterest).toBeGreaterThan(5000);
    expect(result.termData.totalInterest).toBeLessThan(7000);

    // Interest should decrease over time as principal is paid
    const firstMonthInterest = result.months[0].interest;
    const lastMonthInterest = result.months[result.months.length - 1].interest;
    expect(firstMonthInterest).toBeGreaterThan(lastMonthInterest);
  });

  it("should maintain balance consistency", () => {
    const startingBalance = 500000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;
    const extraPayment = 200;

    const result = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment,
    });

    // Check first month
    const firstMonth = result.months[0];
    expect(firstMonth.startingBalance).toBe(startingBalance);
    expect(firstMonth.endingBalance).toBeCloseTo(
      firstMonth.startingBalance - firstMonth.principal,
      2
    );

    // Check last month
    const lastMonth = result.months[result.months.length - 1];
    expect(lastMonth.endingBalance).toBeCloseTo(
      result.termData.endingBalance,
      2
    );

    // Check consecutive months
    for (let i = 1; i < result.months.length; i++) {
      const prevMonth = result.months[i - 1];
      const currMonth = result.months[i];
      expect(currMonth.startingBalance).toBeCloseTo(prevMonth.endingBalance, 2);
    }
  });

  it("should reduce remaining amortization by term length (not actual months)", () => {
    const startingBalance = 500000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;
    const extraPayment = 1000; // Large extra payment

    const result = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment,
    });

    // Even if paid off early, remaining months should be reduced by term length
    expect(result.remainingMonths).toBe(240); // 300 - 60, not 300 - actualMonths
  });
});

describe("simulateTermWithoutExtra", () => {
  it("should calculate total interest without extra payments", () => {
    const startingBalance = 500000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;

    const totalInterest = simulateTermWithoutExtra({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
    });

    expect(totalInterest).toBeGreaterThan(0);
    expect(totalInterest).toBeLessThan(startingBalance);
  });

  it("should match interest from simulateTerm when extraPayment is 0", () => {
    const startingBalance = 500000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;

    const termResult = simulateTerm({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
      extraPayment: 0,
    });

    const interestWithoutExtra = simulateTermWithoutExtra({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
    });

    expect(interestWithoutExtra).toBeCloseTo(
      termResult.termData.totalInterest,
      2
    );
  });

  it("should stop early if balance is paid off", () => {
    const startingBalance = 10000;
    const annualRate = 5.5;
    const termLengthMonths = 60;
    const remainingAmortizationMonths = 300;

    const totalInterest = simulateTermWithoutExtra({
      startingBalance,
      annualRate,
      termLengthMonths,
      remainingAmortizationMonths,
    });

    expect(totalInterest).toBeGreaterThan(0);
    expect(totalInterest).toBeLessThan(startingBalance);
  });
});

describe("simulateFullMortgage", () => {
  it("should simulate a complete mortgage with single term", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 25; // Single term
    const extraPayment = 0;
    const termRates = [5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    expect(result.allMonths.length).toBeGreaterThan(0);
    expect(result.allMonths.length).toBeLessThanOrEqual(amortizationYears * 12);
    expect(result.termSummaries).toHaveLength(1);
    expect(result.totals.totalInterestPaid).toBeGreaterThan(0);
    expect(result.totals.totalExtraPaid).toBe(0);
    expect(result.totals.finalBalance).toBeLessThanOrEqual(0.01);
  });

  it("should handle multiple terms with different rates", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5; // 5 terms
    const extraPayment = 0;
    const termRates = [5.5, 6.0, 5.0, 4.5, 5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    expect(result.termSummaries.length).toBeGreaterThanOrEqual(5);

    // Check that different terms have different rates
    const uniqueRates = new Set(
      result.termSummaries.map((t) => t.interestRate)
    );
    expect(uniqueRates.size).toBeGreaterThan(1);
  });

  it("should apply extra payments correctly across full mortgage", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 500;
    const termRates = [5.5, 5.5, 5.5, 5.5, 5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // Should have extra payments - calculate expected amount
    const expectedTotalExtraPaid = extraPayment * result.totals.totalMonths;
    expect(result.totals.totalExtraPaid).toBeCloseTo(expectedTotalExtraPaid, 2);

    // Should save interest - compare with scenario without extra payments
    const resultWithoutExtra = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment: 0,
      termRates,
    });
    const expectedInterestSaved =
      resultWithoutExtra.totals.totalInterestPaid -
      result.totals.totalInterestPaid;
    expect(result.totals.totalInterestSaved).toBeCloseTo(
      expectedInterestSaved,
      2
    );

    // Should pay off faster
    const monthsWithExtra = result.totals.totalMonths;
    expect(monthsWithExtra).toBeLessThan(resultWithoutExtra.totals.totalMonths);
  });

  it("should extend last rate if fewer rates than terms", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5; // 5 terms needed
    const extraPayment = 0;
    const termRates = [5.5, 6.0]; // Only 2 rates provided

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // Should have 5 terms
    expect(result.termSummaries.length).toBeGreaterThanOrEqual(5);

    // Last terms should use last rate (6.0)
    const lastTerm = result.termSummaries[result.termSummaries.length - 1];
    expect(lastTerm.interestRate).toBe(6.0);
  });

  it("should calculate interest saved correctly", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 1000;
    const termRates = [5.5, 5.5, 5.5, 5.5, 5.5];

    const resultWithExtra = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    const resultWithoutExtra = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment: 0,
      termRates,
    });

    const calculatedInterestSaved =
      resultWithoutExtra.totals.totalInterestPaid -
      resultWithExtra.totals.totalInterestPaid;

    expect(resultWithExtra.totals.totalInterestSaved).toBeCloseTo(
      calculatedInterestSaved,
      2
    );
  });

  it("should assign correct term numbers to months", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 0;
    const termRates = [5.5, 6.0, 5.0];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // First term months should have termNumber = 1
    const firstTermMonths = result.allMonths.filter((m) => m.termNumber === 1);
    expect(firstTermMonths.length).toBe(60); // 5 years * 12 months

    // Check term boundaries
    const termBoundaries = result.allMonths.filter(
      (m, i, arr) => i === 0 || m.termNumber !== arr[i - 1].termNumber
    );
    expect(termBoundaries.length).toBeGreaterThan(1);
  });

  it("should maintain continuous amortization (same payment across terms)", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 0;
    const termRates = [5.5, 6.0, 5.0, 4.5, 5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // All months should have same required payment (continuous amortization)
    const requiredPayments = result.allMonths.map((m) => m.requiredPayment);

    // Should be same payment (allowing for floating point precision)
    const firstPayment = requiredPayments[0];
    requiredPayments.forEach((payment) => {
      expect(payment).toBeCloseTo(firstPayment, 2);
    });
  });

  it("should handle early payoff with large extra payments", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 10000; // Very large extra payment
    const termRates = [5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // Should pay off much faster than 25 years
    // With $10,000 extra per month on $500,000 at 5.5%, should pay off in roughly 3-4 years
    expect(result.totals.totalMonths).toBeLessThan(amortizationYears * 12);
    expect(result.totals.totalMonths).toBeLessThan(60); // Should be less than 5 years
    expect(result.totals.totalMonths).toBeGreaterThan(30); // But more than 2.5 years
    expect(result.totals.finalBalance).toBeLessThanOrEqual(0.01);

    // Verify total extra paid is correct
    expect(result.totals.totalExtraPaid).toBeCloseTo(
      extraPayment * result.totals.totalMonths,
      2
    );
  });

  it("should distribute interest saved across terms proportionally", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 500;
    const termRates = [5.5, 6.0, 5.0];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // Sum of term interest saved should equal total interest saved
    const sumTermInterestSaved = result.termSummaries.reduce(
      (sum, term) => sum + term.interestSaved,
      0
    );
    expect(sumTermInterestSaved).toBeCloseTo(
      result.totals.totalInterestSaved,
      2
    );
  });

  it("should handle zero extra payments", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 0;
    const termRates = [5.5, 5.5, 5.5, 5.5, 5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    expect(result.totals.totalExtraPaid).toBe(0);
    expect(result.totals.totalInterestSaved).toBe(0);

    // All months should have zero extra payment
    result.allMonths.forEach((month) => {
      expect(month.extraPayment).toBe(0);
    });
  });

  it("should calculate correct totals", () => {
    const initialBalance = 500000;
    const amortizationYears = 25;
    const termLengthYears = 5;
    const extraPayment = 500;
    const termRates = [5.5, 5.5, 5.5, 5.5, 5.5];

    const result = simulateFullMortgage({
      initialBalance,
      amortizationYears,
      termLengthYears,
      extraPayment,
      termRates,
    });

    // Verify totals structure
    expect(result.totals).toHaveProperty("totalMonths");
    expect(result.totals).toHaveProperty("totalYears");
    expect(result.totals).toHaveProperty("remainingMonths");
    expect(result.totals).toHaveProperty("totalInterestPaid");
    expect(result.totals).toHaveProperty("totalExtraPaid");
    expect(result.totals).toHaveProperty("totalInterestSaved");
    expect(result.totals).toHaveProperty("finalBalance");

    // Verify totals are consistent
    expect(result.totals.totalYears * 12 + result.totals.remainingMonths).toBe(
      result.totals.totalMonths
    );

    // Total extra paid should be extraPayment * totalMonths
    expect(result.totals.totalExtraPaid).toBeCloseTo(
      extraPayment * result.totals.totalMonths,
      2
    );
  });
});

describe("Edge Cases and Integration", () => {
  it("should handle very small mortgage amounts", () => {
    const result = simulateFullMortgage({
      initialBalance: 1000,
      amortizationYears: 5,
      termLengthYears: 5,
      extraPayment: 0,
      termRates: [5.5],
    });
    expect(result.totals.finalBalance).toBeLessThanOrEqual(0.01);
    expect(result.allMonths.length).toBeGreaterThan(0);
  });

  it("should handle very large mortgage amounts", () => {
    const result = simulateFullMortgage({
      initialBalance: 5_000_000,
      amortizationYears: 30,
      termLengthYears: 5,
      extraPayment: 0,
      termRates: [5.5, 5.5, 5.5],
    });
    expect(result.totals.totalInterestPaid).toBeGreaterThan(0);
    expect(result.totals.finalBalance).toBeLessThanOrEqual(0.01);
  });

  it("should handle very short amortization periods", () => {
    const result = simulateFullMortgage({
      initialBalance: 500_000,
      amortizationYears: 5,
      termLengthYears: 5,
      extraPayment: 0,
      termRates: [5.5],
    });
    expect(result.totals.totalMonths).toBeLessThanOrEqual(60);
    expect(result.totals.finalBalance).toBeLessThanOrEqual(0.01);
  });

  it("should handle very long amortization periods", () => {
    const result = simulateFullMortgage({
      initialBalance: 500000,
      amortizationYears: 40,
      termLengthYears: 5,
      extraPayment: 0,
      termRates: [5.5, 5.5, 5.5],
    });
    expect(result.totals.totalMonths).toBeLessThanOrEqual(480);
    expect(result.totals.finalBalance).toBeLessThanOrEqual(0.01);
  });

  it("should maintain balance consistency across full mortgage", () => {
    const result = simulateFullMortgage({
      initialBalance: 500000,
      amortizationYears: 25,
      termLengthYears: 5,
      extraPayment: 500,
      termRates: [5.5, 6.0, 5.0],
    });

    // Check first month
    const firstMonth = result.allMonths[0];
    expect(firstMonth.startingBalance).toBe(500000);

    // Check last month
    const lastMonth = result.allMonths[result.allMonths.length - 1];
    expect(lastMonth.endingBalance).toBeCloseTo(result.totals.finalBalance, 2);

    // Verify the fundamental balance equation for each month:
    // endingBalance = startingBalance - principal
    // This is the core relationship that must hold
    result.allMonths.forEach((month) => {
      expect(month.endingBalance).toBeCloseTo(
        month.startingBalance - month.principal,
        2
      );

      // Verify payment components add up correctly
      expect(month.totalPayment).toBeCloseTo(
        month.requiredPayment + month.extraPayment,
        2
      );

      // Verify principal + interest = total payment (approximately, due to rounding)
      const paymentComponents = month.interest + month.principal;
      expect(paymentComponents).toBeCloseTo(month.totalPayment, 1);
    });
  });

  it("should handle single month term", () => {
    const result = simulateFullMortgage({
      initialBalance: 100000,
      amortizationYears: 1,
      termLengthYears: 1 / 12,
      extraPayment: 0,
      termRates: [5.5],
    });
    expect(result.allMonths.length).toBeGreaterThan(0);
    expect(result.termSummaries.length).toBeGreaterThan(0);
  });
});
