const User = require('../models/user');
const Task = require('../models/task');
const mongoose = require('mongoose');

module
    .exports = function (router) {

    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');

    // USERS ROUTE

    tasksRoute.get(async function (req, res) {
        try {
            const query = Task.find();
            if (req.query["where"]) {
                query.find(JSON.parse(req.query.where));
                //            const users = await query.exec();
//            return res.status(200).json({message: "success" + req.query.where, data: users});
            }
            if (req.query["sort"]) {
                query.sort(JSON.parse(req.query.sort));
            }
            if (req.query["select"]) {
                query.select(JSON.parse(req.query.select));
            }
            if (req.query["skip"]) {
                query.skip(parseInt(req.query.skip));
            }
            if (req.query["limit"]) {
                query.limit(parseInt(req.query.limit));
            }
            if (req.query["count"]) {
                const count = await query.countDocuments();
                return res.json({message: "OK", data: count})
            }
            const tasks = await query.exec();
            return res.json({message: "OK", data: tasks});
        } catch (err) {
            return res.status(500).json({message: err, data: null});
        }
    });

    tasksRoute.post(async function (req, res) {
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({message: "Bad payload", data: null});
        }
        try {
            const task = await Task.create(req.body);
            return res.status(201).json({message: "OK", data: task});
        } catch (err) {
            if (err.name === 'Validation Error') {
                return res.status(400).json({message: err.message, data: null});
            }
            return res.status(500).json({message: "An error occured", data: null});
        }
    });


    // USERS ID ROUTE

    tasksIdRoute.get(async function (req, res) {
        try {
            const query = Task.findById(req.params.id);
            if (req.query["select"]) {
                query.select(JSON.parse(req.query.select));
            }
            const task = await query.exec();
            if (!task) {
                return res.status(404).json({message: "Task not found", data: null});
            }
            return res.status(200).json({message: "OK", data: task});
        } catch (err) {
            res.status(500).json({message: "An error occured", data: null});
        }
    });

    tasksIdRoute.put(async function (req, res) {
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({message: "Bad payload", data: null});
        }
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const task = await Task.findById(
                req.params.id,
                null,
                {session}
            )
            if (!task) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({message: "Task not found", data: null});
            }
            if (req.body.name) task.name = req.body.name;
            if (req.body.description) task.description = req.body.description;
            if (req.body.deadline) task.deadline = new Date(req.body.deadline);
            if (req.body.hasOwnProperty('completed')) task.completed = req.body.completed;
            if (req.body.hasOwnProperty('assignedUser')) {
                const prev = task.assignedUser;
                // if we are assiginng a user, do stuff
                // if "",
                if (req.body.assignedUser !== "") {
                    const user = await User.findById(req.body.assignedUser, null, {session})
                    if (!user) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(404).json({message: "User not found", data: null});
                    }
                    task.assignedUser = user._id;
                    task.assignedUserName = user.name;
                } else {
                    task.assignedUser = "";
                    task.assignedUserName = "no name assigned";
                }
                await task.save({session});

                if (prev !== "" && prev !== req.body.assignedUser) {
                    const user = await User.findById(req.body.assignedUser, null, {session})
                    if (!user) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(404).json({message: "User not found", data: null});
                    }
                    user.pendingTasks = user.pendingTasks.filter(
                        taskId => taskId.toString() !== task._id.toString()
                    );
                }
            }
            await session.commitTransaction();
            return res.status(201).json({message: "User updated", data: task});
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({message: "An error occured", data: null});
        }
    });

    tasksIdRoute.delete(async function (req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const task = await Task.findByIdAndDelete(req.params.id, {session});
            if (!task) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({message: "Task not found", data: null});
            }
            if (task.assignedUser !== "") {
                const user = await User.findById(req.body.assignedUser, null, {session})
                if (!user) {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({message: "User not found", data: null});
                }
                user.pendingTasks = user.pendingTasks.filter(
                    taskId => taskId.toString() !== task._id.toString()
                );
            }
            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({message: "User deleted", data: task});

        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({message: "An error occured", data: null});
        }
    })

    return router;
}
