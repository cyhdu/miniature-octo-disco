const User = require('../models/user');
const Task = require('../models/task');
const mongoose = require('mongoose');

module
    .exports = function (router) {

    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');

    // USERS ROUTE

    usersRoute.get(async function (req, res) {
        try {
            const query = User.find();
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
            const users = await query.exec();
            return res.json({message: "OK", data: users});
        } catch (err) {
            return res.status(500).json({message: "An error occurred", data: null});
        }
    });

    usersRoute.post(async function (req, res) {
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({message: "Bad payload", data: null});
        }
        try {
            const user = await User.create(req.body);
            return res.status(201).json({message: "OK", data: user});
        } catch (err) {
            if (err.name === 'Validation Error') {
                return res.status(400).json({message: err.message, data: null});
            } else if (err.code === 11000) {
                return res.status(400).json({message: "duplicate email", data: null});
            }
            return res.status(500).json({message: "An error occured", data: null});
        }
    });


    // USERS ID ROUTE

    usersIdRoute.get(async function (req, res) {
        try {
            const query = User.findById(req.params.id);
            if (req.query["select"]) {
                query.select(JSON.parse(req.query.select));
            }
            const user = await query.exec();
            if (!user) {
                return res.status(404).json({message: "User not found", data: null});
            }
            return res.status(200).json({message: "OK", data: user});
        } catch (err) {
            res.status(500).json({message: "An error occured", data: null});
        }
    });

    usersIdRoute.put(async function (req, res) {
        let s = "";
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({message: "Bad payload", data: null});
        }
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const user = await User.findByIdAndUpdate(
                req.params.id,
                req.body,
                {new: true, runValidators: true, session}
            )
            if (user.pendingTasks) {
                for (let taskId of req.body.pendingTasks) {
                    s += taskId;
                    const task = await Task.findById(taskId, null, {session});
                    if (!task) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(404).json({message: "Task not found", data: null});
                    }
                    task.assignedUser = req.params.id;
                    task.assignedUserName = user.name;
                    await task.save({session});
                }
            }
            if (!user) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({message: "User not found", data: null});
            }
            await session.commitTransaction();
            session.endSession();
            return res.status(201).json({message: "User updated", data: user});
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            if (err.name === 'Validation Error') {
                return res.status(400).json({message: err.message, data: null});
            } else if (err.code === 11000) {
                return res.status(400).json({message: "duplicate email", data: null});
            }
            return res.status(500).json({message: "An error occured", data: null});
        }
    });

    usersIdRoute.delete(async function (req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const user = await User.findByIdAndDelete(req.params.id, {session});
            if (!user) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({message: "User not found", data: null});
            }
            if (user.pendingTasks) {
                for (let taskId of user.pendingTasks) {
                    const task = await Task.findById(taskId, null, {session});
                    if (!task) {
                        console.log("task not found");
                        continue;
                    }
                    task.assignedUser = "";
                    task.assignedUserName = "no name assigned";
                    await task.save({session});
                }
            }
            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({message: "User deleted", data: user});

        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({message: "An error occurred" + err, data: null});
        }
    })

    return router;
}
