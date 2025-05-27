const tools = [
  { name: "Word & Character Counter", url: "tools/word-counter/index.html" },
  { name: "JSON Validator", url: "tools/json-validator/index.html" },
  { name: "Base64 Encoder/Decoder", url: "tools/base64-encoder/index.html" }
];

const searchBar = document.getElementById("search-bar");
const suggestionsList = document.getElementById("suggestions");

searchBar.addEventListener("input", function () {
  const query = this.value.toLowerCase();
  suggestionsList.innerHTML = "";

  if (!query) {
    suggestionsList.style.display = "none";
    return;
  }

  const matches = tools.filter(tool => tool.name.toLowerCase().includes(query));

  matches.forEach(match => {
    const li = document.createElement("li");
    li.textContent = match.name;
    li.addEventListener("click", () => {
      window.location.href = match.url;
    });
    suggestionsList.appendChild(li);
  });

  suggestionsList.style.display = matches.length ? "block" : "none";
});
