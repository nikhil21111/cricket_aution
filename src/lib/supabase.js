import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we should use mock database
const useMock = !supabaseUrl || !supabaseAnonKey || 
  !supabaseUrl.startsWith("https://") ||
  supabaseUrl.includes("your_") || 
  supabaseUrl.includes("placeholder") || 
  supabaseAnonKey.includes("placeholder") ||
  supabaseAnonKey.includes("your_");

let supabaseClient;

if (useMock) {
  console.log("🛠️ Using Mock Supabase Client with LocalStorage backing.");

  // Global listeners for real-time channels
  const listeners = [];

  const getDB = () => {
    try {
      const data = localStorage.getItem("mock_supabase_db");
      return data ? JSON.parse(data) : { tournaments: [], teams: [], players: [], auction_state: [] };
    } catch (e) {
      return { tournaments: [], teams: [], players: [], auction_state: [] };
    }
  };

  const saveDB = (db) => {
    localStorage.setItem("mock_supabase_db", JSON.stringify(db));
  };

  // Helper to notify listeners of changes
  const notifyListeners = (table, eventType, payload) => {
    listeners.forEach((listener) => {
      if (listener.table === table) {
        // Check filter if any (e.g., tournament_id=eq.UUID)
        if (listener.filter) {
          const [col, filterVal] = listener.filter.split("=eq.");
          if (col && filterVal && payload[col] != filterVal) {
            return; // Skip if filter doesn't match
          }
        }
        listener.callback({
          eventType,
          schema: "public",
          table,
          new: payload,
          old: eventType === "DELETE" ? payload : undefined,
        });
      }
    });
  };

  class MockQueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.filters = [];
      this.orderCol = null;
      this.orderAsc = true;
      this.isSingle = false;
      this.action = "select"; // select, insert, update, delete
      this.insertData = null;
      this.updateData = null;
    }

    select() {
      if (this.action !== "insert" && this.action !== "update" && this.action !== "delete") {
        this.action = "select";
      }
      return this;
    }

    insert(data) {
      this.action = "insert";
      this.insertData = data;
      return this;
    }

    update(data) {
      this.action = "update";
      this.updateData = data;
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    match(obj) {
      this.filters.push((row) => {
        return Object.entries(obj).every(([key, val]) => row[key] === val);
      });
      return this;
    }

    order(column, { ascending = true } = {}) {
      this.orderCol = column;
      this.orderAsc = ascending;
      return this;
    }

    single() {
      this.isSingle = true;
      return this;
    }

    // To behave like a promise
    async then(onFulfilled, onRejected) {
      try {
        const result = await this.execute();
        return onFulfilled(result);
      } catch (err) {
        if (onRejected) return onRejected(err);
        throw err;
      }
    }

    async execute() {
      const db = getDB();
      const actualTableName = this.tableName === "public_live_tournaments" ? "tournaments" : this.tableName;
      let table = db[actualTableName] || [];

      if (this.action === "select") {
        let data = table.filter((row) => this.filters.every((f) => f(row)));
        
        if (this.orderCol) {
          data.sort((a, b) => {
            let valA = a[this.orderCol];
            let valB = b[this.orderCol];
            if (typeof valA === "string") {
              return this.orderAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return this.orderAsc ? valA - valB : valB - valA;
          });
        }

        if (this.isSingle) {
          return { data: data[0] || null, error: data[0] ? null : { message: "Not found", code: "PGRST116" } };
        }
        return { data, error: null };
      }

      if (this.action === "insert") {
        const rowsToInsert = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const newRows = rowsToInsert.map((row) => {
          const id = row.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
          const newRow = {
            id,
            created_at: new Date().toISOString(),
            ...row,
          };
          
          if (actualTableName === "tournaments") {
            newRow.status = newRow.status || "draft";
            newRow.default_purse = newRow.default_purse || 10000000;
            newRow.default_base_price = newRow.default_base_price || 200000;
            newRow.teams_count = newRow.teams_count || 0;
            newRow.players_count = newRow.players_count || 0;
          } else if (actualTableName === "teams") {
            newRow.total_purse = newRow.total_purse || 10000000;
            newRow.remaining_purse = newRow.remaining_purse || 10000000;
            newRow.icon_player_count = newRow.icon_player_count || 0;
          } else if (actualTableName === "players") {
            newRow.status = newRow.status || "available";
            newRow.base_price = newRow.base_price || 200000;
            newRow.role = newRow.role || "batsman";
            newRow.icon_role = newRow.icon_role || "none";
          } else if (actualTableName === "auction_state") {
            newRow.is_live = newRow.is_live || false;
            newRow.highest_bid = newRow.highest_bid || 0;
          }

          return newRow;
        });

        db[actualTableName] = [...table, ...newRows];
        saveDB(db);

        // Update counts on tournament if applicable
        if (actualTableName === "teams" || actualTableName === "players") {
          const countsKey = actualTableName === "teams" ? "teams_count" : "players_count";
          newRows.forEach(row => {
            if (row.tournament_id) {
              const tourney = db.tournaments.find(t => t.id === row.tournament_id);
              if (tourney) {
                tourney[countsKey] = (tourney[countsKey] || 0) + 1;
              }
            }
          });
          saveDB(db);
        }

        newRows.forEach((row) => {
          notifyListeners(actualTableName, "INSERT", row);
        });

        return { data: Array.isArray(this.insertData) ? newRows : newRows[0], error: null };
      }

      if (this.action === "update") {
        let updatedRows = [];
        db[actualTableName] = table.map((row) => {
          if (this.filters.every((f) => f(row))) {
            const updatedRow = { ...row, ...this.updateData, updated_at: new Date().toISOString() };
            updatedRows.push(updatedRow);
            return updatedRow;
          }
          return row;
        });
        saveDB(db);

        updatedRows.forEach((row) => {
          notifyListeners(actualTableName, "UPDATE", row);
        });

        return { data: updatedRows, error: null };
      }

      if (this.action === "delete") {
        let deletedRows = [];
        db[actualTableName] = table.filter((row) => {
          if (this.filters.every((f) => f(row))) {
            deletedRows.push(row);
            return false;
          }
          return true;
        });
        saveDB(db);

        if (actualTableName === "teams" || actualTableName === "players") {
          const countsKey = actualTableName === "teams" ? "teams_count" : "players_count";
          deletedRows.forEach(row => {
            if (row.tournament_id) {
              const tourney = db.tournaments.find(t => t.id === row.tournament_id);
              if (tourney && tourney[countsKey] > 0) {
                tourney[countsKey] -= 1;
              }
            }
          });
          saveDB(db);
        }

        deletedRows.forEach((row) => {
          notifyListeners(actualTableName, "DELETE", row);
        });

        return { data: deletedRows, error: null };
      }
    }
  }

  const mockUser = {
    id: "mock-user-id",
    email: "mockuser@example.com",
    user_metadata: {
      full_name: "Mock User",
    },
  };

  supabaseClient = {
    auth: {
      async getSession() {
        return { data: { session: { user: mockUser } }, error: null };
      },
      onAuthStateChange(callback) {
        setTimeout(() => callback("SIGNED_IN", { user: mockUser }), 0);
        return {
          data: {
            subscription: {
              unsubscribe() {
                // No-op
              },
            },
          },
        };
      },
      async signUp({ email, password, options }) {
        return {
          data: {
            user: {
              id: "mock-user-id",
              email,
              user_metadata: options?.data || {},
            },
          },
          error: null,
        };
      },
      async signInWithPassword({ email, password }) {
        return {
          data: {
            user: {
              id: "mock-user-id",
              email,
              user_metadata: { full_name: "Mock User" },
            },
          },
          error: null,
        };
      },
      async signOut() {
        return { error: null };
      },
    },

    from(tableName) {
      return new MockQueryBuilder(tableName);
    },

    channel(channelName) {
      return {
        on(event, options, callback) {
          const actualTable = options.table === "public_live_tournaments" ? "tournaments" : options.table;
          listeners.push({
            channelName,
            table: actualTable,
            filter: options.filter,
            callback,
          });
          return this;
        },
        subscribe() {
          return {
            unsubscribe() {
              const idx = listeners.findIndex((l) => l.channelName === channelName);
              if (idx !== -1) {
                listeners.splice(idx, 1);
              }
            },
          };
        },
      };
    },

    storage: {
      from(bucket) {
        return {
          async upload(fileName, file) {
            return { data: { path: fileName }, error: null };
          },
          getPublicUrl(fileName) {
            return {
              data: {
                publicUrl: `https://images.unsplash.com/photo-1540747737956-37872404a8c3?auto=format&fit=crop&q=80&w=400`,
              },
            };
          },
        };
      },
    },
  };
} else {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseClient;

// Helper to upload image to Supabase Storage
export const uploadImage = async (bucket, file) => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file);

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(fileName);

  return publicUrl;
};

// Format currency in points format
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "0 pts";

  if (amount >= 1000000) {
    const value = amount / 1000000;
    return `${value.toFixed(2)}M pts`;
  } else if (amount >= 1000) {
    const value = amount / 1000;
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)}K pts`;
  }
  return `${amount.toLocaleString()} pts`;
};

// Format short currency
export const formatShortCurrency = (amount) => {
  if (!amount && amount !== 0) return "0 pts";

  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M pts`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K pts`;
  }
  return `${amount} pts`;
};
