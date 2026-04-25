import db from './db';

export function seedIfNeeded(vaultId: number) {
  const done = db.prepare('SELECT id FROM seed_done WHERE id = 1').get();
  if (done) return;

  db.transaction(() => {
    // Accounts
    const insertAccount = db.prepare(
      'INSERT INTO accounts (name, type, balance, on_budget, vault_id) VALUES (?, ?, ?, ?, ?)'
    );
    insertAccount.run('1822 Giro', 'cash', 29334.13, 1, vaultId);
    insertAccount.run('Tagesgeld', 'cash', 9200.00, 1, vaultId);
    insertAccount.run('Hosentasche - Jens', 'cash', 150.00, 1, vaultId);
    insertAccount.run('Hosentasche - Bettina', 'cash', 67.04, 1, vaultId);
    insertAccount.run('American Express', 'credit', -618.31, 1, vaultId);
    insertAccount.run('Darlehen Björn', 'tracking', 300.00, 0, vaultId);
    insertAccount.run('Darlehen Mella', 'tracking', 500.00, 0, vaultId);
    insertAccount.run('Darlehen M&M Paikert', 'tracking', 2000.00, 0, vaultId);

    // Category groups
    db.prepare('INSERT INTO category_groups (name, sort_order, vault_id) VALUES (?, ?, ?)').run('Credit Card Payments', 1, vaultId);
    const fixkostenId = (db.prepare("INSERT INTO category_groups (name, sort_order, vault_id) VALUES (?, ?, ?) RETURNING id").get('Fixkosten', 2, vaultId) as { id: number }).id;
    const fixkostenAbId = (db.prepare("INSERT INTO category_groups (name, sort_order, vault_id) VALUES (?, ?, ?) RETURNING id").get('Fixkosten aber abschaffbar', 3, vaultId) as { id: number }).id;
    const alltagId = (db.prepare("INSERT INTO category_groups (name, sort_order, vault_id) VALUES (?, ?, ?) RETURNING id").get('Alltag', 4, vaultId) as { id: number }).id;
    const sparzielId = (db.prepare("INSERT INTO category_groups (name, sort_order, vault_id) VALUES (?, ?, ?) RETURNING id").get('Sparziele (1822Direkt)', 5, vaultId) as { id: number }).id;

    // Categories
    const insertCat = db.prepare(
      'INSERT INTO categories (group_id, name, sort_order, is_goal, goal_amount, goal_type) VALUES (?, ?, ?, ?, ?, ?)'
    );

    // Fixkosten
    const mieteId = (db.prepare("INSERT INTO categories (group_id, name, sort_order) VALUES (?, ?, ?) RETURNING id").get(fixkostenId, 'Miete', 1) as { id: number }).id;
    insertCat.run(fixkostenId, 'Schulessen', 2, 0, null, null);
    insertCat.run(fixkostenId, 'Telefon Festnetz', 3, 0, null, null);
    insertCat.run(fixkostenId, 'Deutschlandticket', 4, 0, null, null);
    insertCat.run(fixkostenId, 'Handyanbieter Jens', 5, 0, null, null);
    insertCat.run(fixkostenId, 'Handyanbieter Bettina', 6, 0, null, null);

    // Fixkosten abschaffbar
    insertCat.run(fixkostenAbId, 'Streaming-Dienste', 1, 0, null, null);
    insertCat.run(fixkostenAbId, 'Zeitschriften', 2, 0, null, null);

    // Alltag
    insertCat.run(alltagId, 'Einkaufen', 1, 0, null, null);
    insertCat.run(alltagId, 'Spaß & Freizeit', 2, 0, null, null);

    // Sparziele
    insertCat.run(sparzielId, 'Miniserver', 1, 1, 1000, 'eventual');
    insertCat.run(sparzielId, 'Synology', 2, 1, 500, 'eventual');
    const rücklagenId = (db.prepare("INSERT INTO categories (group_id, name, sort_order, is_goal, goal_amount, goal_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").get(sparzielId, 'Rücklage Reparatur', 3, 1, 1000, 'eventual') as { id: number }).id;
    const urlaubId = (db.prepare("INSERT INTO categories (group_id, name, sort_order, is_goal, goal_amount, goal_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").get(sparzielId, 'Urlaub', 4, 1, 3500, 'eventual') as { id: number }).id;

    // Budgets for April 2026
    const insertBudget = db.prepare(
      'INSERT OR REPLACE INTO budgets (category_id, month, assigned) VALUES (?, ?, ?)'
    );
    insertBudget.run(mieteId, '2026-04', 522.41);
    insertBudget.run(rücklagenId, '2026-04', 1000);
    insertBudget.run(urlaubId, '2026-04', 800);

    // Sample transactions
    const insertTx = db.prepare(
      'INSERT INTO transactions (account_id, category_id, date, amount, payee, cleared) VALUES (?, ?, ?, ?, ?, ?)'
    );
    // Income
    insertTx.run(1, null, '2026-04-01', 3500.00, 'Arbeitgeber Jens', 1);
    insertTx.run(1, null, '2026-04-01', 2800.00, 'Arbeitgeber Bettina', 1);
    // Expenses
    insertTx.run(1, mieteId, '2026-04-02', -522.41, 'Vermieter', 1);
    insertTx.run(1, null, '2026-04-10', -85.30, 'REWE', 1);
    insertTx.run(1, null, '2026-04-15', -42.00, 'Netflix', 0);
    insertTx.run(1, null, '2026-04-20', -120.50, 'Restaurant Zum Wirt', 0);
    insertTx.run(5, null, '2026-04-18', -618.31, 'Amazon', 1);

    // Stats data for previous months
    for (let i = 1; i <= 4; i++) {
      const monthDate = new Date(2026, 3 - i, 1);
      const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      insertTx.run(1, null, `${month}-01`, 3500 + Math.random() * 200 - 100, 'Arbeitgeber Jens', 1);
      insertTx.run(1, null, `${month}-01`, 2800 + Math.random() * 200 - 100, 'Arbeitgeber Bettina', 1);
      insertTx.run(1, null, `${month}-05`, -(400 + Math.random() * 100), 'Verschiedene Ausgaben', 1);
      insertTx.run(1, null, `${month}-15`, -(600 + Math.random() * 100), 'Fixkosten', 1);
    }

    db.prepare('INSERT INTO seed_done (id) VALUES (1)').run();
  })();
}
