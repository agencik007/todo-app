module.exports = {
  "frontend/src/**/*.{ts,html,scss}": (files) => {
    const filteredFiles = files.filter(
      (file) => !file.includes("generated-api"),
    );
    if (filteredFiles.length === 0) return [];
    return [`prettier --write ${filteredFiles.join(" ")}`];
  },
  "frontend/src/**/*.{ts,html}": (files) => {
    const filteredFiles = files.filter(
      (file) => !file.includes("generated-api"),
    );
    if (filteredFiles.length === 0) return [];
    return [
      `eslint --config frontend/eslint.config.js --fix ${filteredFiles.join(" ")}`,
    ];
  },
  "backend/**/*.py": ["ruff format", "ruff check --fix"],
};
