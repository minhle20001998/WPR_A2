const express = require('express')
const cors = require('cors');
const mongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const mongo = require('mongodb');

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }));
const url = "mongodb://localhost:27017/";
const connect = mongoClient.connect(url);
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
/*if there is incompleted attempt, send it to client
    else create new attempt and set it to client*/
app.post('/attempts', (req, res) => {
    findAttempts({ completed: false }, function (dbs, result) {
        if (result.length > 0) {
            res.json(result[0]);
        } else {
            createAttempt(function (dbs, attempt, insert) {
                res.json(attempt);
            });
        }
    })
});
/*take user submit id -> search it in database
    @return attempt with score and text, mark that attempt as "completed" 
*/
app.post('/attempts/:id/submit', (req, res) => {
    const reqId = req.params.id;
    const o_id = new mongo.ObjectID(reqId);
    const reqAns = req.body.answers;
    let scores = 0;

    findAttempts({ '_id': o_id }, async function (dbs, result) {
        let response = result[0];
        let correctAnswers = {};
        console.log(result);
        for (let i = 0; i < result[0].questions.length; i++) {
            const client = await mongoClient.connect(url, { useNewUrlParser: true })
                .catch(err => { console.log(err); });
            const qID = result[0].questions[i]._id;
            try {
                const db = client.db("A2");
                let collection = db.collection('questions');
                let query = { '_id': qID }
                let res = await collection.findOne(query);
                correctAnswers[qID] = res.correctAnswer;
                if (reqAns[qID] == res.correctAnswer) {
                    scores++;
                }
            }
            catch (err) {
                console.log(err);
            } finally {
                client.close();
            }
        }
        response["correctAnswers"] = correctAnswers;
        response["score"] = scores;
        response["completed"] = true;
        if (scores < 5) {
            response["scoreText"] = `Practice more to improve it :D`;
        } else if (scores >= 5 && scores < 7) {
            response["scoreText"] = `Good, keep up!`;
        } else if (scores >= 7 && scores < 9) {
            response["scoreText"] = 'Well done';
        } else if (scores >= 9 && scores < 10) {
            response["scoreText"] = 'Perfect!!';
        }
        dbs.collection("attempts").updateOne(
            { '_id': o_id },
            [{ $set: response }]
        );
        res.json(response);
    });

});
//find attempt using query param
function findAttempts(query, callback) {
    connect.then(function (db) {
        let dbs = db.db("A2");
        dbs.collection(`attempts`).find(query).toArray(function (err, result) {
            if (err) throw err;
            callback(dbs, result)
        })
    })
}
//find function 
function findQuery(collection, query, callback) {
    connect.then(function (db) {
        let dbs = db.db("A2");
        dbs.collection(collection).find({}, query).toArray(function (err, result) {
            if (err) throw err;
            callback(dbs, result);
        });
    })
}
//get question from dbs with randomize order
function getQuestions(callback) {
    findQuery("questions", { projection: { correctAnswer: 0 } }, function (dbs, dbQuestions) {
        let randomQuestions = [];
        const arr = [];
        while (arr.length < 10) {
            let randomNumber = Math.floor(Math.random() * 10);
            if (!arr.includes(randomNumber)) {
                arr.push(randomNumber);
                randomQuestions.push(dbQuestions[randomNumber]);
            }
        }
        console.log(randomQuestions);
        callback(dbs, randomQuestions);
    });
}

//create new attempt
function createAttempt(callback) {
    getQuestions(async function (dbs, randomQuestions) {
        let attempt = {};
        attempt.questions = randomQuestions;
        attempt.startedAt = new Date();
        attempt.completed = false;
        attempt._v = 0;
        const insert = await dbs.collection("attempts").insertOne(attempt);
        callback(dbs, attempt, insert);
    })
}




