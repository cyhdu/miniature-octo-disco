var mongoose = require('mongoose');

var TaskSchema = new mongoose.Schema({
    name: {type: String, required: [true, "name required"]},
    description: {type: String, default: ""},
    deadline: {type: Date, required: [true, "deadline required"]},
    completed: {type: Boolean, default: false},
    assignedUser: {type: String, default: ""},
    assignedUserName: {type: String, default: "no name assigned"},
    dateCreated: {type: Date, default: Date.now}
})

// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);

