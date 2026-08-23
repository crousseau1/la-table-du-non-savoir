const fs = require("fs");
const path = require("path");

const CRUD_BASE = "https://crudcrud.com/api/b8c1378c5fcb4a13887726c6f483b89f";
const ROOT = path.join(__dirname, "..");

async function main() {
  const questionsRes = await fetch(`${CRUD_BASE}/questions`);
  const questionsRows = questionsRes.ok ? await questionsRes.json() : [];
  const questionsDoc = Array.isArray(questionsRows) ? questionsRows[0] : null;
  if (questionsDoc && questionsDoc.questions) {
    const payload = {
      updatedAt: questionsDoc.updatedAt || new Date().toISOString(),
      questions: questionsDoc.questions,
    };
    fs.writeFileSync(
      path.join(ROOT, "data", "questions.json"),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
  }

  const playsRes = await fetch(`${CRUD_BASE}/plays`);
  const plays = playsRes.ok ? await playsRes.json() : [];
  fs.writeFileSync(
    path.join(ROOT, "data", "plays.json"),
    JSON.stringify(Array.isArray(plays) ? plays : [], null, 2),
    "utf8"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
