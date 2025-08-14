const db = db.getSiblingDB('stock_analysis');
db.createUser({
  user: 'admin',
  pwd: 'admin',
  roles: [
    {
      role: 'dbOwner',
      db: 'stock_analysis',
    },
  ],
});
