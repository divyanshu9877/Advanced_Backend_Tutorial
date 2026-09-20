import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name:String,
    email:String,
    Password:String
},{timestamps:true})

const User = mongoose.model("user",userSchema)
export default User