# Budget

Application de bureau pour le budget mensuel. Elle tourne sur l’ordinateur, sans navigateur. Une installation neuve est vide : les chiffres arrivent par un fichier de profil, pas dans le programme.

## Télécharger le programme

Le bouton vert **Code** télécharge le code source. Il n’y a pas de `Budget.exe` dedans.

Le programme est ce fichier :

https://github.com/RyanJPM/budget/releases/latest/download/Budget-Setup.zip

1. Télécharge `Budget-Setup.zip`.
2. Extrais-le dans un dossier que tu gardes.
3. Ouvre `Budget.exe`, qui est directement dans ce dossier.
4. L’icône **Budget** se pose sur le bureau.

Si Windows affiche SmartScreen : Informations complémentaires, puis Exécuter quand même.

## Profil

La page Profil crée, renomme et change de profil. L’export écrit un fichier `.budget` chiffré avec un mot de passe. Le même logiciel, sur un autre ordinateur, le relit avec ce mot de passe. Supprimer un profil demande trois confirmations, et propose d’abord d’enregistrer cette copie.

Le dépôt ne contient aucun budget. Garde le fichier `.budget` chez toi.

## Saisie

Le salaire habituel est touché le mois suivant. Une facture se met dans les charges : n’importe quel nom, pas seulement celles déjà prévues. Une course, un achat ou un prélèvement se met dans les dépenses : une fois, plusieurs mois, ou un premier montant puis des suivants. Les montants acceptent la virgule.

Sauter un mois, sur une dépense, décale un prélèvement : le mois sauté n’est pas annulé, les suivants avancent d’un cran. Une dépense répétée est seulement en pause ce mois-là. Une dépense unique passe au mois suivant.

Une vente se range dans Objets vendus, le mois où l’argent est encaissé. Le minimum à garder reste dans la poche et n’est pas une dépense. Vide, il vaut 150 €. Écris 0 pour ne rien garder.

Le bouton Design, en bas, propose cinq apparences. Clair et sombre ne concernent que Défaut. Ce choix reste sur l’ordinateur, il n’est pas dans le fichier de profil.
