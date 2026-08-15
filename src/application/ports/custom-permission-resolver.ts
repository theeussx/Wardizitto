export interface CustomPermissionResolver {
  hasPermission(
    guildId: string,
    userId: string,
    roleIds: readonly string[],
    permission: string,
  ): Promise<boolean>;
}
