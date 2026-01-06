
def starts_one_ends(n):
    """
    Given a positive integer n, return the count of the numbers of n-digit
    positive integers that start or end with 1.
    """
if n == 1:
        return 1
    # Numbers that start with 1: 1 * 10^(n-1) possibilities (1 followed by any n-1 digits)
    # Numbers that end with 1: 9 * 10^(n-2) * 1 possibilities (first digit 1-9, middle n-2 digits 0-9, last digit 1)
    # Numbers that start AND end with 1: 10^(n-2) possibilities (1, any n-2 digits, 1)
    # By inclusion-exclusion: start_with_1 + end_with_1 - both
    start_with_1 = 10 ** (n - 1)
    end_with_1 = 9 * (10 ** (n - 2))
    both = 10 ** (n - 2)
    return start_with_1 + end_with_1 - both