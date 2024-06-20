const { hashPassword, verifyPassword } = require("secure-password-hash");

let password = "Olamilekan";
let { hash: hashed, salt: salted } = hashPassword(password);
console.log(hashed, salted);
