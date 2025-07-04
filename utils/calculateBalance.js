export const calculateUserBalance = (userDetails) => {
  // Helper function to sum an array of objects by key
  const sumAmounts = (items, key = "amount") =>
    items.reduce((sum, item) => sum + (item[key] || 0), 0);

  // Calculate totals
  const totalDeposits = sumAmounts(
    userDetails.Deposits.filter((deposit) => deposit.status === "successful")
  );
  const totalInvestments = sumAmounts(
    userDetails.Investments.filter(
      (investment) => investment.status === "completed"
    ),
    "payoutAmount"
  );
  const totalCompletedInvestments = sumAmounts(
    userDetails.Investments.filter(
      (investment) => investment.status === "completed"
    )
  );
  const totalPendingInvestments = sumAmounts(
    userDetails.Investments.filter(
      (investment) => investment.status === "running"
    )
  );
  const totalBonuses = sumAmounts(userDetails.Bonuses);

  const totalPenalties = sumAmounts(userDetails.Penalties);
  const totalWithdrawals = sumAmounts(userDetails.Withdrawals.filter(
    (withdrawal) => withdrawal.status !== "failed"
  ));

  // Calculate balance
  return (
    ( totalDeposits + totalInvestments + totalBonuses ) - ( totalPenalties + totalWithdrawals + totalPendingInvestments + totalCompletedInvestments)
  );
};

export const calculateReferralBalance = (userDetails) => {
  // Helper function to sum an array of objects by key
  const sumAmounts = (items, key = "amount") =>
    items.reduce((sum, item) => sum + (item[key] || 0), 0);

  const totalEarnings = sumAmounts(userDetails.Earnings);
  return totalEarnings;
}