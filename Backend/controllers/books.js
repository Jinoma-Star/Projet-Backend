const Book = require('../models/book');
const average = require('../utils/average');
const fs = require('fs');

// Création d'un livre
exports.createBook = (req, res, next) => {
    const bookObject = JSON.parse(req.body.book); // Parse le JSON du corps de la requête
    delete bookObject._id; // Supprime l'_id envoyé par le front-end, s'il y en a un
    delete bookObject._userId; // Supprime le _userId pour des raisons de sécurité
    const book = new Book({
        ...bookObject,
        userId: req.auth.userId, // Ajoute l'userId de l'authentificateur
        imageUrl: `${req.protocol}://${req.get('host')}/images/resized_${req.file.filename}`, // Construit l'URL de l'image
        averageRating: bookObject.ratings[0].grade // Initialise la note moyenne
    });
    book.save()
        .then(() => res.status(201).json({ message: 'Objet enregistré !' }))
        .catch(error => res.status(400).json({ error }));
};

// Récupération d'un livre par son ID
exports.getOneBook = (req, res, next) => {
    Book.findOne({ _id: req.params.id })
        .then(book => res.status(200).json(book))
        .catch(error => res.status(404).json({ error }));
};

// Modification d'un livre
exports.modifyBook = (req, res, next) => {
    const bookObject = req.file ? {
        ...JSON.parse(req.body.book),
        imageUrl: `${req.protocol}://${req.get('host')}/images/resized_${req.file.filename}`
    } : { ...req.body };
    delete bookObject._userId;
    Book.findOne({ _id: req.params.id })
        .then((book) => {
            if (book.userId != req.auth.userId) {
                res.status(403).json({ message: 'Unauthorized request' });
            } else {
                req.file && fs.unlink(`images/${book.imageUrl.split('/images/')[1]}`, err => console.log(err));
                Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
                    .then(() => res.status(200).json({ message: 'Objet modifié !' }))
                    .catch(error => res.status(400).json({ error }));
            }
        })
        .catch(error => res.status(404).json({ error }));
};

// Suppression d'un livre
exports.deleteBook = (req, res, next) => {
    Book.findOne({ _id: req.params.id })
        .then(book => {
            if (book.userId != req.auth.userId) {
                res.status(403).json({ message: 'Unauthorized request' });
            } else {
                fs.unlink(`images/${book.imageUrl.split('/images/')[1]}`, () => {
                    Book.deleteOne({ _id: req.params.id })
                        .then(() => res.status(200).json({ message: 'Objet supprimé !' }))
                        .catch(error => res.status(400).json({ error }));
                });
            }
        })
        .catch(error => res.status(404).json({ error }));
};

// Récupération de tous les livres
exports.getAllBooks = (req, res, next) => {
    Book.find()
        .then(books => res.status(200).json(books))
        .catch(error => res.status(404).json({ error }));
};

// Création d'une note pour un livre
exports.createRating = (req, res, next) => {
    if (0 <= req.body.rating && req.body.rating <= 5) {
        const ratingObject = { ...req.body, grade: req.body.rating };
        delete ratingObject._id;
        Book.findOne({_id: req.params.id})
            .then(book => {
                if (book.ratings.map(rating => rating.userId).includes(req.auth.userId)) {
                    res.status(403).json({ message: 'Not authorized' });
                } else {
                    book.ratings.push(ratingObject);
                    book.averageRating = average.average(book.ratings.map(rating => rating.grade));
                    Book.updateOne({ _id: req.params.id }, { ratings: book.ratings, averageRating: book.averageRating, _id: req.params.id })
                        .then(() => res.status(200).json(book))
                        .catch(error => res.status(400).json({ error }));
                }
            })
            .catch(error => res.status(404).json({ error }));
    } else {
        res.status(400).json({ message: 'Rating must be between 0 and 5' });
    }
};

// Récupération des trois livres ayant les meilleures notes
exports.getBestRating = (req, res, next) => {
    Book.find().sort({ averageRating: -1 }).limit(3)
        .then(books => res.status(200).json(books))
        .catch(error => res.status(404).json({ error }));
};