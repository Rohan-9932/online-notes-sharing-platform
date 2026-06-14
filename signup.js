window.onload = function () {
  alert("JS FILE CONNECTED");

  const form = document.getElementById("signupForm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value;

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    console.log(name);
    console.log(email);
    console.log(password);

    const response = await fetch("http://localhost:5000/signup", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const result = await response.text();

    alert(result);
  });
};
