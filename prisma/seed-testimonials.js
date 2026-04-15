import { db } from "../lib/prisma.js";

async function main() {
  await db.testimonial.createMany({
    data: [
      {
        name: "Rahul M.",
        role: "CS Student, VTU",
        quote:
          "Used Welth to track my internship stipend and daily expenses. The receipt scanner actually works — saved me a lot of manual entry.",
      },
      {
        name: "Priya S.",
        role: "Freelance Designer",
        quote:
          "Budget alerts are genuinely useful. Got notified when I was about to overshoot my groceries budget before the month ended.",
      },
      {
        name: "Aditya K.",
        role: "Software Engineer Intern",
        quote:
          "Clean UI and the anomaly detection caught an unusual subscription charge I had forgotten about. Really impressed.",
      },
    ],
  });
  console.log("Testimonials seeded.");
}

main().catch(console.error).finally(() => db.$disconnect());