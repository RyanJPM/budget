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

Le salaire habituel est touché le mois suivant. Une facture se met dans les charges. Une course, un achat ou un prélèvement se met dans les dépenses : une fois, plusieurs mois, ou un premier montant puis des suivants. Une vente se range dans Objets vendus, le mois où l’argent est encaissé. Le minimum à garder reste dans la poche et n’est pas une dépense.
