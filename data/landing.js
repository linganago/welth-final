import {
  BarChart3,
  Receipt,
  PieChart,
  CreditCard,
  Zap,
  RefreshCcw,
  ShieldAlert,
  Mail,
} from "lucide-react";

// Features Data — only what's actually implemented
export const featuresData = [
  {
    icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
    title: "Advanced Analytics",
    description:
      "Get detailed insights into your spending patterns with AI-powered analytics",
  },
  {
    icon: <Receipt className="h-8 w-8 text-blue-600" />,
    title: "Smart Receipt Scanner",
    description:
      "Upload a photo of any receipt — Gemini AI extracts amount, date, and category automatically",
  },
  {
    icon: <PieChart className="h-8 w-8 text-blue-600" />,
    title: "Budget Planning",
    description:
      "Set monthly budgets per category and get alerted when you hit 80% of your limit",
  },
  {
    icon: <CreditCard className="h-8 w-8 text-blue-600" />,
    title: "Multi-Account Support",
    description: "Manage multiple savings and current accounts in one place",
  },
  {
    icon: <RefreshCcw className="h-8 w-8 text-blue-600" />,
    title: "Recurring Transactions",
    description:
      "Set up daily, weekly, or monthly recurring transactions — processed automatically in the background",
  },
  {
    icon: <ShieldAlert className="h-8 w-8 text-blue-600" />,
    title: "Anomaly Detection",
    description:
      "Statistically flags transactions that are unusually high compared to your 3-month category average",
  },
  {
    icon: <Mail className="h-8 w-8 text-blue-600" />,
    title: "Monthly AI Reports",
    description:
      "Receive AI-generated financial summaries by email at the end of every month",
  },
  {
    icon: <Zap className="h-8 w-8 text-blue-600" />,
    title: "Automated Insights",
    description:
      "Get automated financial insights and recommendations powered by Gemini",
  },
];

// How It Works Data
export const howItWorksData = [
  {
    icon: <CreditCard className="h-8 w-8 text-blue-600" />,
    title: "1. Create Your Account",
    description:
      "Get started in minutes with our simple and secure sign-up process",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
    title: "2. Track Your Spending",
    description:
      "Automatically categorize and track your transactions in real-time",
  },
  {
    icon: <PieChart className="h-8 w-8 text-blue-600" />,
    title: "3. Get Insights",
    description:
      "Receive AI-powered insights and recommendations to optimize your finances",
  },
];