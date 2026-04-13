import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export default function EmailTemplate({
  userName = "",
  type = "monthly-report",
  data = {},
}) {
  // ── Monthly Report ────────────────────────────────────────────────────────
  if (type === "monthly-report") {
    return (
      <Html>
        <Head />
        <Preview>Your Monthly Financial Report</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Monthly Financial Report</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              Here&rsquo;s your financial summary for {data?.month}:
            </Text>

            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.label}>Total Income</Text>
                <Text style={styles.statValue}>${data?.stats?.totalIncome}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Total Expenses</Text>
                <Text style={styles.statValue}>${data?.stats?.totalExpenses}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Net</Text>
                <Text style={styles.statValue}>
                  ${(data?.stats?.totalIncome ?? 0) - (data?.stats?.totalExpenses ?? 0)}
                </Text>
              </div>
            </Section>

            {data?.stats?.byCategory && (
              <Section style={styles.section}>
                <Heading style={styles.heading}>Expenses by Category</Heading>
                {Object.entries(data.stats.byCategory).map(([cat, amt]) => (
                  <div key={cat} style={styles.row}>
                    <Text style={styles.text}>{cat}</Text>
                    <Text style={styles.text}>${amt}</Text>
                  </div>
                ))}
              </Section>
            )}

            {data?.insights && (
              <Section style={styles.section}>
                <Heading style={styles.heading}>Welth Insights</Heading>
                {data.insights.map((insight, i) => (
                  <Text key={i} style={styles.text}>• {insight}</Text>
                ))}
              </Section>
            )}

            <Text style={styles.footer}>
              Thank you for using Welth. Keep tracking your finances!
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  // ── Budget Alert ──────────────────────────────────────────────────────────
  if (type === "budget-alert") {
    return (
      <Html>
        <Head />
        <Preview>Budget Alert</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Budget Alert</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              You&rsquo;ve used {data?.percentageUsed?.toFixed(1)}% of your monthly budget.
            </Text>
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.label}>Budget Amount</Text>
                <Text style={styles.statValue}>${data?.budgetAmount}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Spent So Far</Text>
                <Text style={styles.statValue}>${data?.totalExpenses}</Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Remaining</Text>
                <Text style={styles.statValue}>
                  ${(parseFloat(data?.budgetAmount ?? 0) - parseFloat(data?.totalExpenses ?? 0)).toFixed(1)}
                </Text>
              </div>
            </Section>
            <Text style={styles.footer}>
              Consider reviewing your spending to stay within your budget.
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  // ── Spending Anomaly Alert (NEW) ──────────────────────────────────────────
  if (type === "anomaly-alert") {
    const percentOver = data?.mean > 0
      ? (((data?.amount - data?.mean) / data?.mean) * 100).toFixed(0)
      : 0;

    return (
      <Html>
        <Head />
        <Preview>Unusual spending detected — {data?.category}</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={{ ...styles.title, color: "#dc2626" }}>
              Unusual Spending Detected
            </Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              We noticed an unusually large transaction in the{" "}
              <strong>{data?.category}</strong> category.
            </Text>

            <Section style={styles.alertBox}>
              <Text style={styles.explanation}>{data?.explanation}</Text>
            </Section>

            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.label}>This Transaction</Text>
                <Text style={{ ...styles.statValue, color: "#dc2626" }}>
                  ${Number(data?.amount ?? 0).toFixed(2)}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>Your Avg ({data?.category})</Text>
                <Text style={styles.statValue}>
                  ${Number(data?.mean ?? 0).toFixed(2)}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.label}>% Above Average</Text>
                <Text style={{ ...styles.statValue, color: "#dc2626" }}>
                  +{percentOver}%
                </Text>
              </div>
            </Section>

            <Text style={styles.text}>
              If this transaction looks correct, no action is needed. If it looks
              unfamiliar, please review your account activity immediately.
            </Text>

            <Text style={styles.footer}>
              This alert was generated automatically by Welth based on your
              spending history. You can adjust alert thresholds in your settings.
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  return null;
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: "-apple-system, sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px",
    borderRadius: "5px",
    maxWidth: "600px",
  },
  title: {
    color: "#1f2937",
    fontSize: "28px",
    fontWeight: "bold",
    textAlign: "center",
    margin: "0 0 20px",
  },
  heading: {
    color: "#1f2937",
    fontSize: "18px",
    fontWeight: "600",
    margin: "0 0 12px",
  },
  text: {
    color: "#4b5563",
    fontSize: "16px",
    margin: "0 0 16px",
    lineHeight: "1.5",
  },
  label: {
    color: "#6b7280",
    fontSize: "13px",
    margin: "0 0 4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statValue: {
    color: "#111827",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0",
  },
  section: {
    marginTop: "24px",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
  },
  alertBox: {
    marginTop: "16px",
    marginBottom: "16px",
    padding: "16px",
    backgroundColor: "#fef2f2",
    borderRadius: "6px",
    border: "1px solid #fecaca",
  },
  explanation: {
    color: "#991b1b",
    fontSize: "15px",
    margin: "0",
    lineHeight: "1.5",
    fontStyle: "italic",
  },
  statsContainer: {
    margin: "24px 0",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
  },
  stat: {
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#fff",
    borderRadius: "4px",
    border: "1px solid #f3f4f6",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  footer: {
    color: "#9ca3af",
    fontSize: "13px",
    textAlign: "center",
    marginTop: "32px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
  },
};
