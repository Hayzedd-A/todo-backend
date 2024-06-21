const { hashPassword, verifyPassword } = require("secure-password-hash");

let password = "Olamilekan";
let { hash: hashed, salt: salted } = hashPassword(password);
console.log(hashed, salted);

let user = { id: "2" };
let { parseInt(id): id } = user;
console.log(id);

try {
    
} catch (error) {
    
}