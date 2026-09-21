import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { authApi } from "../../api/auth";

// Thunks --------------------------------------------------------------------
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(email, password);
      localStorage.setItem("jwt_access", data.access);
      localStorage.setItem("jwt_refresh", data.refresh);
      const me = await authApi.me();
      return me.data;
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || "Login failed");
    }
  }
);

export const loadUser = createAsyncThunk("auth/loadUser", async (_, { rejectWithValue }) => {
  if (!localStorage.getItem("jwt_access")) return rejectWithValue("no token");
  try {
    const { data } = await authApi.me();
    return data;
  } catch (e) {
    return rejectWithValue("session invalid");
  }
});

// Slice ---------------------------------------------------------------------
const initialState = {
  user: null,
  accessToken: localStorage.getItem("jwt_access") || null,
  status: "idle", // idle | loading | authenticated | error
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },
    logout: (state) => {
      localStorage.removeItem("jwt_access");
      localStorage.removeItem("jwt_refresh");
      state.user = null;
      state.accessToken = null;
      state.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(login.fulfilled, (s, a) => {
        s.status = "authenticated";
        s.user = a.payload;
        s.accessToken = localStorage.getItem("jwt_access");
      })
      .addCase(login.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload;
      })
      .addCase(loadUser.fulfilled, (s, a) => {
        s.status = "authenticated";
        s.user = a.payload;
      })
      .addCase(loadUser.rejected, (s) => {
        s.status = "idle";
        s.user = null;
      });
  },
});

export const { logout, setAccessToken } = authSlice.actions;
export default authSlice.reducer;
